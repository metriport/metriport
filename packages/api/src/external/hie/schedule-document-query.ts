import { Patient } from "@metriport/core/domain/patient";
import { MedicalDataSource } from "@metriport/core/external/index";
import { processAsyncError } from "@metriport/core/util/error/shared";
import { out } from "@metriport/core/util/log";
import { getPatientOrFail } from "../../command/medical/patient/get-patient";
import { PatientModel } from "../../models/medical/patient";
import { executeOnDBTx } from "../../models/transaction-wrapper";
import { isStalePatientUpdateEnabledForCx } from "../aws/app-config";
import { isPatientDiscoveryDataMissingOrProcessing, isPatientDiscoveryDataStale } from "./shared";

type sharedPdArgs = {
  patient: Patient;
  requestId: string;
};

/**
 * Checks whether to schedule document query and if so, schedules it.
 * If the document query is already scheduled, it will not be scheduled again.
 */
export async function scheduleDocQuery<T>({
  requestId,
  patient,
  source,
  triggerConsolidated,
  patientDiscoveryActions,
  forceScheduling = false,
}: {
  requestId: string;
  patient: Pick<Patient, "id" | "cxId">;
  source: MedicalDataSource;
  triggerConsolidated: boolean;
  patientDiscoveryActions: {
    pd: (sharedPdArgs: sharedPdArgs & T) => Promise<void>;
    extraPdArgs: T;
  };
  forceScheduling?: boolean;
}): Promise<Patient> {
  const { log } = out(`${source} scheduleDocQuery - requestId ${requestId}, patient ${patient.id}`);

  const patientFilter = {
    id: patient.id,
    cxId: patient.cxId,
  };

  const isStaleUpdateEnabled = await isStalePatientUpdateEnabledForCx(patient.cxId);

  return await executeOnDBTx(PatientModel.prototype, async transaction => {
    const existingPatient = await getPatientOrFail({
      ...patientFilter,
      lock: true,
      transaction,
    });

    const externalData = existingPatient.data.externalData ?? {};

    const { hasNoHieStatus, isHieStatusProcessing } = isPatientDiscoveryDataMissingOrProcessing({
      patient: existingPatient,
      source,
    });
    const isStale = isPatientDiscoveryDataStale({ patient: existingPatient, source });
    const isStaleAndUpdateEnabled = isStale && isStaleUpdateEnabled;

    const shouldSchedule =
      hasNoHieStatus || isHieStatusProcessing || isStaleAndUpdateEnabled || forceScheduling;
    if (!shouldSchedule) {
      log("Scheduling document query skipped");
      return existingPatient;
    }

    const shouldRunPd = isStaleAndUpdateEnabled && !isHieStatusProcessing;
    if (shouldRunPd) {
      log(`Patient is stale or patient discovery forced - kicking off PD ${requestId}`);
      patientDiscoveryActions
        .pd({
          patient: existingPatient,
          requestId,
          ...patientDiscoveryActions.extraPdArgs,
        })
        .catch(
          processAsyncError(
            `${source} patientDiscoveryActions.pd failed - patient ${existingPatient.id}, requestId ${requestId}`
          )
        );
    }

    const existingScheduledDqRequestId = externalData[source]?.scheduledDocQueryRequestId;
    if (existingScheduledDqRequestId) {
      log(
        `Scheduled document query exists w/ requestId ${existingScheduledDqRequestId} - skipping scheduling`
      );
      return existingPatient;
    }

    log("Scheduling document query");
    externalData[source] = {
      ...externalData[source],
      scheduledDocQueryRequestId: requestId,
      scheduledDocQueryRequestTriggerConsolidated: triggerConsolidated,
    };

    const updatedPatient = {
      ...existingPatient.dataValues,
      data: {
        ...existingPatient.data,
        externalData,
      },
    };

    await PatientModel.update(updatedPatient, {
      where: patientFilter,
      transaction,
    });

    return updatedPatient;
  });
}
