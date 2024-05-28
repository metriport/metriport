import { Patient, PatientDemoData } from "@metriport/core/domain/patient";
import { getPatientOrFail } from "../../../command/medical/patient/get-patient";
import { PatientModel } from "../../../models/medical/patient";
import { executeOnDBTx } from "../../../models/transaction-wrapper";
import { LinkStatus } from "../../patient-link";

/**
 * Sets the CareQuality (CQ) integration status on the patient.
 *
 * @param patient The patient @ Metriport.
 * @param status The status of integrating/synchronizing the patient across CareQuality.
 * @param discoveryRequestId The request ID of integrating/synchronizing the patient across CareQuality.
 * @param discoveryFacilityId The facility ID of integrating/synchronizing the patient across CareQuality.
 * @param discoveryStartedAt The start date of integrating/synchronizing the patient across CareQuality.
 * @param rerunPdOnNewDemographics The flag for determining whether to re-run pattient discovery again if new demographic data is found.
 * @param augmentedDemographics The payload actually used across CQ after demogrpahic augmentation.
 * @returns
 */
export async function updatePatientDiscoveryStatus({
  patient,
  status,
  discoveryRequestId,
  discoveryFacilityId,
  discoveryStartedAt,
  rerunPdOnNewDemographics,
  augmentedDemographics,
}: {
  patient: Pick<Patient, "id" | "cxId">;
  status?: LinkStatus;
  discoveryRequestId?: string;
  discoveryFacilityId?: string;
  discoveryStartedAt?: Date;
  rerunPdOnNewDemographics?: boolean;
  augmentedDemographics?: PatientDemoData;
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
        ...(status && { discoveryStatus: status }),
        ...(discoveryRequestId && { discoveryRequestId }),
        ...(discoveryFacilityId && { discoveryFacilityId }),
        ...(discoveryStartedAt && { discoveryStartedAt }),
        ...(rerunPdOnNewDemographics && { rerunPdOnNewDemographics }),
        ...(augmentedDemographics && { augmentedDemographics }),
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
