import { Patient } from "@metriport/core/domain/patient";
import { DiscoveryParams } from "@metriport/core/domain/patient-discovery";
import { getPatientOrFail } from "../../../command/medical/patient/get-patient";
import { PatientModel } from "../../../models/medical/patient";
import { executeOnDBTx } from "../../../models/transaction-wrapper";
import { LinkStatus } from "../../patient-link";

/**
 * Sets the CareQuality (CQ) integration status on the patient.
 *
 * @param patient The patient @ Metriport.
 * @param status The status of integrating/synchronizing the patient across CareQuality.
 * @param params.requestId The request ID of integrating/synchronizing the patient across CareQuality.
 * @param params.facilityId The facility ID of integrating/synchronizing the patient across CareQuality.
 * @param params.startedAt The start date of integrating/synchronizing the patient across CareQuality.
 * @param params.rerunPdOnNewDemographics The flag for determining whether to re-run pattient discovery again if new demographic data is found.
 * @returns
 */
export async function updatePatientDiscoveryStatus({
  patient,
  status,
  params,
}: {
  patient: Pick<Patient, "id" | "cxId">;
  status: LinkStatus;
  params?: DiscoveryParams;
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

    if (!params && !externalData.CAREQUALITY?.discoveryParams) {
      // Backward compatability during deployment phase
      //throw new Error(`Cannot update discovery status before assigning discovery params @ CQ`);
    }

    const updatePatientDiscoveryStatus = {
      ...externalData,
      CAREQUALITY: {
        ...externalData.CAREQUALITY,
        discoveryStatus: status,
        ...(params && { discoveryParams: params }),
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
