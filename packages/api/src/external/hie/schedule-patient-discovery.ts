import { MedicalDataSource } from "@metriport/core/external/index";
import { Patient } from "@metriport/core/domain/patient";
import { out } from "@metriport/core/util/log";
import { getPatientOrFail } from "../../command/medical/patient/get-patient";
import { PatientModel } from "../../models/medical/patient";
import { executeOnDBTx } from "../../models/transaction-wrapper";

/**
 * Stores the scheduled patient discovery to be executed when the current patient discovery is completed.
 */
export async function schedulePatientDiscovery({
  patient: { id, cxId },
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
  const { log } = out(`${source} PD - requestId ${requestId}, patient ${id}`);

  log(`Scheduling patient discovery to be executed`);

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
      ...patient,
      data: {
        ...patient.data,
        externalData: updatedExternalData,
      },
    };

    await PatientModel.update(updatedPatient, { where: patientFilter, transaction });
  });
}
