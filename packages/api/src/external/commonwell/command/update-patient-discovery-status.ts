import { getPatientOrFail } from "../../../command/medical/patient/get-patient";
import { Patient } from "@metriport/core/domain/patient";
import { PatientModel } from "../../../models/medical/patient";
import { executeOnDBTx } from "../../../models/transaction-wrapper";
import { LinkStatus } from "../../patient-link";

/**
 * Sets the CommonWell (CW) Patient Discovery status on the patient.
 *
 * @param patient The patient @ Metriport.
 * @param status The status of integrating/synchronizing the patient @ CommonWell.
 * @param requestId The requestId of PD process. Set once per request ID.
 * @param facilityId The facilityId of PD process. Set once per request ID.
 * @param startedAt The startedAt of PD process. Set once per request ID.
 * @returns Updated Patient.
 */
export const updatePatientDiscoveryStatus = async ({
  patient,
  status,
  requestId,
  facilityId,
  startedAt,
}: {
  patient: Pick<Patient, "id" | "cxId">;
  status: LinkStatus;
  requestId?: string;
  facilityId?: string;
  startedAt?: Date;
}): Promise<Patient> => {
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
      COMMONWELL: {
        ...externalData.COMMONWELL,
        status,
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
};
