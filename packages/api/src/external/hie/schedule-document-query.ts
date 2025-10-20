import { MedicalDataSource } from "@metriport/core/external/index";
import { Patient } from "@metriport/core/domain/patient";
import { out } from "@metriport/core/util/log";
import { getPatientOrFail } from "../../command/medical/patient/get-patient";
import { PatientModel } from "../../models/medical/patient";
import { executeOnDBTx } from "../../models/transaction-wrapper";

/**
 * Stores the requestId as the scheduled document query to be executed when the patient discovery
 * is completed.
 */
export async function scheduleDocQuery({
  requestId,
  patient: { id, cxId },
  source,
  triggerConsolidated,
}: {
  requestId: string;
  patient: Pick<Patient, "id" | "cxId">;
  source: MedicalDataSource;
  triggerConsolidated?: boolean;
}): Promise<void> {
  const { log } = out(`${source} DQ - requestId ${requestId}, patient ${id}`);

  log(`Scheduling document query to be executed`);

  const patientFilter = { id, cxId };
  return executeOnDBTx(PatientModel.prototype, async transaction => {
    const patient = await getPatientOrFail({
      ...patientFilter,
      lock: true,
      transaction,
    });

    const externalData = patient.data.externalData ?? {};

    const updatedExternalData = {
      ...externalData,
      [source]: {
        ...externalData[source],
        scheduledDocQueryRequestId: requestId,
        ...(triggerConsolidated && {
          scheduledDocQueryRequestTriggerConsolidated: triggerConsolidated,
        }),
      },
    };

    const updatedPatient = {
      ...patient,
      data: {
        ...patient.data,
        externalData: updatedExternalData,
      },
    };

    await PatientModel.update(updatedPatient, { where: patientFilter, transaction });
  });
}
