import { executeAsynchronously } from "@metriport/core/util/concurrency";
import { MetriportError } from "@metriport/core/util/error/metriport-error";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { queryDocumentsAcrossHIEs } from "../../../command/medical/document/document-query";
import { Patient } from "../../../domain/medical/patient";
import { CQLinkStatus } from "../patient-shared";
import { setCQLinkStatus } from "./cq-link-status";

dayjs.extend(duration);

const PARALLEL_UPDATES = 10;

export const completeEnhancedCoverage = async ({
  cxId,
  patientIds,
  cqLinkStatus,
}: {
  cxId: string;
  patientIds: string[];
  cqLinkStatus: CQLinkStatus;
}): Promise<void> => {
  console.log(
    `Completing EC for ${patientIds.length} patients, to status: ${cqLinkStatus}, ` +
      `and triggering doc query across HIEs`
  );

  // Promise that will be executed for each patient
  const completeECForPatient = async (patientId: string): Promise<void> => {
    const { patient, updated } = await setCQLinkStatus({ cxId, patientId, cqLinkStatus });
    if (!updated) return; // if the status was already set don't do anything else
    if (cqLinkStatus === "linked") await finishEnhancedCoverage(patient);
  };

  await executeAsynchronously(patientIds, completeECForPatient, {
    numberOfParallelExecutions: PARALLEL_UPDATES,
  });
};

/**
 * Finish the enhanced coverage for the patient.
 */
async function finishEnhancedCoverage(patient: Patient): Promise<void> {
  const facilityId = patient.facilityIds[0];
  if (!facilityId) {
    console.log(`Patient ${patient.id} has no facility, skipping update...`);
    throw new MetriportError(`Patient ${patient.id} has no facility`);
  }
  await queryDocumentsAcrossHIEs({
    cxId: patient.cxId,
    patientId: patient.id,
    facilityId,
    forceQuery: true,
  });
}
