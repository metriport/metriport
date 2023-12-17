import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { groupBy } from "lodash";
import { Op } from "sequelize";
import { Patient } from "../../../domain/medical/patient";
import { PatientModel } from "../../../models/medical/patient";
import { capture } from "@metriport/core/util/notifications";
import { CQLinkStatus } from "../patient-shared";
import { completeEnhancedCoverage } from "./coverage-enhancement-complete";

dayjs.extend(duration);

const MAX_EC_DURATON = dayjs.duration({ minutes: 40 });

/**
 * Check for patients that have been in processing for too long and force-complete their
 * enhanced coverage.
 */
export async function checkStaleEnhancedCoverage(cxIds: string[]): Promise<void> {
  const patients = await getPatientsWithStaleEC(cxIds);

  notifyStaleEC(patients);

  const patientsByCxId = groupBy(patients, "cxId");
  const cxToCompleteEC = Object.entries(patientsByCxId);

  // Doing this in sequence b/c the function called here already processes patients in sequence
  // to avoid DB connection starvation
  for (const [cxId, patientsOfCx] of cxToCompleteEC) {
    await completeEnhancedCoverage({
      cxId,
      patientIds: patientsOfCx.map(p => p.id),
      cqLinkStatus: "linked",
    });
  }
}

type SimplifiedPatient = Pick<Patient, "id" | "cxId">;

async function getPatientsWithStaleEC(cxIds: string[]): Promise<SimplifiedPatient[]> {
  const earliestDate = dayjs().subtract(MAX_EC_DURATON.asMilliseconds(), "milliseconds").toDate();
  const cqLinkStatuses: CQLinkStatus[] = ["processing"];
  const listOfPatientAnCxId = await PatientModel.findAll({
    attributes: ["id", "cxId"],
    where: {
      ...(cxIds.length ? { cxId: { [Op.in]: cxIds } } : {}),
      data: {
        externalData: {
          COMMONWELL: {
            cqLinkStatus: { [Op.in]: cqLinkStatuses },
          },
        },
      },
      createdAt: { [Op.lte]: earliestDate },
    },
  });
  return listOfPatientAnCxId;
}

function notifyStaleEC(patients: SimplifiedPatient[]): void {
  if (!patients || !patients.length) return;

  const patientsByCx = groupBy(patients, "cxId");
  const msg = `Found patients with stale enhanced coverage`;
  console.log(msg + ` - count: ${patients.length}: ${JSON.stringify(patientsByCx)}`);
  capture.message(msg, {
    extra: { patientsByCx },
    level: "warning",
  });
}
