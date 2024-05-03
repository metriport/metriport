import { Patient } from "@metriport/core/domain/patient";
import { getPatientOrFail } from "../../../command/medical/patient/get-patient";
import { PatientModel } from "../../../models/medical/patient";
import { executeOnDBTx } from "../../../models/transaction-wrapper";

export async function updatePatientDiscoveryStatus({
  patient,
  status,
  requestId,
  facilityId,
  startedAt,
}: {
  patient: Pick<Patient, "id" | "cxId">;
  status: "processing" | "completed" | "failed";
  requestId?: string;
  facilityId?: string;
  startedAt?: Date;
}): Promise<Patient> {
  const patientFilter = {
    id: patient.id,
    cxId: patient.cxId,
  };

  return await executeOnDBTx(PatientModel.prototype, async transaction => {
    const existingPatient = await getPatientOrFail({
      ...patientFilter,
      lock: true,
      transaction,
    });

    const externalData = existingPatient.data.externalData ?? {};

    const updatePatientDiscoveryStatus = {
      ...externalData,
      CAREQUALITY: {
        ...externalData.CAREQUALITY,
        discoveryStatus: status,
        ...(requestId && { pdRequestId: requestId }),
        ...(facilityId && { pdFacilityId: facilityId }),
        ...(startedAt && { pdStartedAt: startedAt }),
      },
    };

    const updatedPatient = {
      ...existingPatient.dataValues,
      data: {
        ...existingPatient.data,
        externalData: updatePatientDiscoveryStatus,
      },
    };

    await PatientModel.update(updatedPatient, {
      where: patientFilter,
      transaction,
    });

    return updatedPatient;
  });
}
