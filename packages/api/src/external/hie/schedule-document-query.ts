import { MedicalDataSource } from "@metriport/core/external/index";
import { Patient } from "@metriport/core/domain/patient";
import { out } from "@metriport/core/util/log";
import { getPatientOrFail } from "../../command/medical/patient/get-patient";
import { PatientModel } from "../../models/medical/patient";
import { executeOnDBTx } from "../../models/transaction-wrapper";
import { isStalePatientUpdateEnabledForCx } from "../aws/app-config";
import { isPatientDiscoveryDataMissingOrProcessing, isPatientDiscoveryDataStale } from "./shared";
import { MetriportError } from "@metriport/shared";

/**
 * Stores the requestId as the scheduled document query to be executed when the patient discovery
 * is completed.
 */
export async function scheduleDocQuery<T>({
  requestId,
  patient,
  source,
  triggerConsolidated,
  scheduleActions,
  forceScheduling = false,
  forcePatientDiscovery = false,
}: {
  requestId: string;
  patient: Pick<Patient, "id" | "cxId">;
  source: MedicalDataSource;
  triggerConsolidated: boolean;
  scheduleActions: {
    pd: (
      sharedPdArgs: {
        patient: Patient;
        requestId: string;
        facilityId: string;
      } & T
    ) => Promise<void>;
    extraPdArgs: T;
  };
  forceScheduling?: boolean;
  forcePatientDiscovery?: boolean;
}): Promise<Patient> {
  const { log } = out(`${source} scheduleDocQuery - requestId ${requestId}, patient ${patient.id}`);

  const patientFilter = {
    id: patient.id,
    cxId: patient.cxId,
  };

  const isStaleUpdatedEnabled = await isStalePatientUpdateEnabledForCx(patient.cxId);

  return await executeOnDBTx(PatientModel.prototype, async transaction => {
    const existingPatient = await getPatientOrFail({
      ...patientFilter,
      lock: true,
      transaction,
    });

    const externalData = existingPatient.data.externalData ?? {};

    const { hasNoHieStatus, hieStatusProcessing } = isPatientDiscoveryDataMissingOrProcessing({
      patient: existingPatient,
      source,
    });
    const isStale =
      isStaleUpdatedEnabled &&
      isPatientDiscoveryDataStale({
        patient: existingPatient,
        source,
      });

    if (hasNoHieStatus || hieStatusProcessing || isStale || forceScheduling) {
      externalData[source] = {
        ...externalData[source],
        scheduledDocQueryRequestId: requestId,
        scheduledDocQueryRequestTriggerConsolidated: triggerConsolidated,
      };

      if ((forcePatientDiscovery || isStale) && !hieStatusProcessing) {
        if (!scheduleActions?.pd) {
          throw new MetriportError(
            `Cannot trigger patient discovery w/ no pdFunction @ ${source}`,
            {
              patientId: patient.id,
              source,
            }
          );
        }
        log("Kicking off PD");
        await scheduleActions.pd({
          patient: existingPatient,
          requestId,
          facilityId: existingPatient.facilityIds[0] as string,
          ...scheduleActions.extraPdArgs,
        });
      }

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
    }

    log(`Scheduling document query ${requestId} skipped`);

    return existingPatient;
  });
}
