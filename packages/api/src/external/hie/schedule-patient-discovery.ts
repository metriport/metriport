import { MedicalDataSource } from "@metriport/core/external/index";
import { Patient } from "@metriport/core/domain/patient";
import { out } from "@metriport/core/util/log";
import { getPatientModelOrFail } from "../../command/medical/patient/get-patient";
import { PatientModel } from "../../models/medical/patient";
import { executeOnDBTx } from "../../models/transaction-wrapper";

/**
 * Stores the scheduled patient discovery to be executed when the current patient discovery is completed.
 */
export async function schedulePatientDiscovery({
  patient,
  source,
  requestId,
  facilityId,
  orgIdExcludeList,
  rerunPdOnNewDemographics,
  forceCarequality,
  forceCommonwell,
}: {
  patient: Pick<Patient, "id" | "cxId">;
  source: MedicalDataSource;
  requestId: string;
  facilityId: string;
  orgIdExcludeList?: string[];
  rerunPdOnNewDemographics?: boolean;
  // START TODO #1572 - remove
  forceCommonwell?: boolean;
  forceCarequality?: boolean;
  // END TODO #1572 - remove
}): Promise<void> {
  const { log } = out(`${source} PD - requestId ${requestId}, patient ${patient.id}`);

  log(`Scheduling patient discovery to be executed`);

  const patientFilter = {
    id: patient.id,
    cxId: patient.cxId,
  };

  return await executeOnDBTx(PatientModel.prototype, async transaction => {
    const existingPatient = await getPatientModelOrFail({
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
          orgIdExcludeList,
          rerunPdOnNewDemographics,
          forceCommonwell,
          forceCarequality,
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
