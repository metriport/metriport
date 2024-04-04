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
  patient,
  source,
}: {
  requestId: string;
  patient: Pick<Patient, "id" | "cxId">;
  source: MedicalDataSource;
}): Promise<void> {
  const { log } = out(`${source} DQ - requestId ${requestId}, patient ${patient.id}`);

  log(`Scheduling document query to be executed`);

  const patientFilter = {
    id: patient.id,
    cxId: patient.cxId,
  };

  await executeOnDBTx(PatientModel.prototype, async transaction => {
    const existingPatient = await getPatientOrFail({
      ...patientFilter,
      lock: true,
      transaction,
    });

    const externalData = existingPatient.data.externalData ?? {};

    const updatedExternalData = {
      ...externalData,
      [source]: {
        ...externalData[source],
        scheduledDocQueryRequestId: requestId,
      },
    };

    const updatedPatient = {
      ...existingPatient.dataValues,
      data: {
        ...existingPatient.data,
        externalData: updatedExternalData,
      },
    };

    await PatientModel.update(updatedPatient, {
      where: patientFilter,
      transaction,
    });
  });
}
