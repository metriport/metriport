import { Patient } from "@metriport/core/domain/patient";
import { getPatientOrFail } from "../../../command/medical/patient/get-patient";
import { PatientModel } from "../../../models/medical/patient";
import { executeOnDBTx } from "../../../models/transaction-wrapper";
import { LinkStatus } from "../../patient-link";

/**
 * Sets the CareQuality (CQ) Patient Discovery status on the patient.
 *
 * @param patient The patient @ Metriport.
 * @param status The status of integrating the patient across CareQuality gateways.
 * @param requestId The requestId of PD process. Set once per request ID.
 * @param facilityId The facilityId of PD process. Set once per request ID.
 * @param startedAt The start of PD process. Set once per request ID. If set, clears existing endedAt.
 * @param endedAt The end of PD process. Set once per request ID. Overrides clearing if set.
 * @returns Updated Patient.
 */
export async function updatePatientDiscoveryStatus({
  patient,
  status,
  requestId,
  facilityId,
  startedAt,
  endedAt,
}: {
  patient: Pick<Patient, "id" | "cxId">;
  status: LinkStatus;
  requestId?: string;
  facilityId?: string;
  startedAt?: Date;
  endedAt?: Date;
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
        ...(startedAt && { pdStartedAt: startedAt, endedAt: undefined }),
        ...(endedAt && { pdEndedAt: endedAt }),
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
