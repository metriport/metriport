import { MedicalDataSource } from "@metriport/core/external/index";
import { Patient } from "@metriport/core/domain/patient";
import { out } from "@metriport/core/util/log";
import { getPatientOrFail } from "../../command/medical/patient/get-patient";
import { PatientModel } from "../../models/medical/patient";
import { executeOnDBTx } from "../../models/transaction-wrapper";

export type ScheuledPatientDiscovery = {
  requestId: string;
  facilityId: string;
  rerunPdOnNewDemographics: boolean;
  augmentDemographics: boolean;
  isRerunFromNewDemographics: boolean;
};

/**
 * Stores the requestId as the scheduled patient discovery to be executed when the current patient discovery
 * is completed.
 */
export async function schedulePatientDiscovery({
  requestId,
  patient,
  source,
  facilityId,
  rerunPdOnNewDemographics,
  augmentDemographics,
  isRerunFromNewDemographics,
}: {
  requestId: string;
  patient: Pick<Patient, "id" | "cxId">;
  source: MedicalDataSource;
  facilityId: string;
  rerunPdOnNewDemographics: boolean;
  augmentDemographics: boolean;
  isRerunFromNewDemographics: boolean;
}): Promise<void> {
  const { log } = out(`${source} PD - requestId ${requestId}, patient ${patient.id}`);

  log(`Scheduling patient discovery to be executed`);

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
        scheduledPdRequest: {
          requestId,
          facilityId,
          rerunPdOnNewDemographics,
          augmentDemographics,
          isRerunFromNewDemographics,
        },
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
