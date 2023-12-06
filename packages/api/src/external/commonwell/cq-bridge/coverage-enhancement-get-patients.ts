import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { Op } from "sequelize";
import { PatientModel } from "../../../models/medical/patient";
import { CQLinkStatus } from "../patient-shared";
import { Patient } from "../../../domain/medical/patient";

dayjs.extend(duration);

// To avoid processing patients that haven't finished being sync'ed @ CW
const MIN_TIME_AFTER_PATIENT_CREATED = dayjs.duration({ minutes: 2 });

/**
 * Get the list of patients to have coverage enhanced through link with CareQuality Orgs.
 */

export async function getPatientsToEnhanceCoverage(cxIds: string[]): Promise<Patient[]> {
  const earliestDate = dayjs()
    .subtract(MIN_TIME_AFTER_PATIENT_CREATED.asMilliseconds(), "milliseconds")
    .toDate();
  const cqLinkStatusNotToLink: CQLinkStatus[] = ["linked", "processing"];
  const patientsWithIds: Patient[] = await PatientModel.findAll({
    where: {
      ...(cxIds.length ? { cxId: { [Op.in]: cxIds } } : {}),
      data: {
        externalData: {
          COMMONWELL: {
            cqLinkStatus: {
              // Intentionally not returning records with `null` b/c we don't want to process
              // those that were already processed before this has been released - new ones
              // gave status `unlinked` by default.
              [Op.notIn]: cqLinkStatusNotToLink,
            },
          },
        },
      },
      createdAt: { [Op.lte]: earliestDate },
    },
  });
  return patientsWithIds;
}
