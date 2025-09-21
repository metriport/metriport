import { Patient } from "@metriport/core/domain/patient";
import { MedicalDataSource } from "@metriport/core/external";
import { processAsyncError } from "@metriport/core/util/error/shared";
import { out } from "@metriport/core/util/log";
import { uuidv7 } from "@metriport/core/util/uuid-v7";
import { getPatientOrFail } from "../../command/medical/patient/get-patient";
import { finishSinglePatientImport } from "../../command/medical/patient/patient-import/finish-single-patient";
import { runOrScheduleCqPatientDiscovery } from "../carequality/command/run-or-schedule-patient-discovery";
import { runOrScheduleCwPatientDiscovery } from "../commonwell/patient/run-or-schedule-patient-discovery";

type PdStateSingleHie = {
  status: "triggered" | "disabled";
};

type PdStateAcrossHies = Partial<Record<MedicalDataSource, PdStateSingleHie>>;

export async function runOrSchedulePatientDiscoveryAcrossHies({
  patient,
  facilityId,
  rerunPdOnNewDemographics,
  forceCommonwell,
  forceCarequality,
  requestId = uuidv7(),
}: {
  patient: Patient;
  facilityId: string;
  rerunPdOnNewDemographics?: boolean;
  // START TODO #1572 - remove
  forceCommonwell?: boolean;
  forceCarequality?: boolean;
  // END TODO #1572 - remove
  requestId?: string;
}): Promise<void> {
  const existingPatient = await getPatientOrFail(patient);
  const pdStateAcrossHies: PdStateAcrossHies = {};

  // CAREQUALITY
  const postCqPdProcessor = getPostPdProcessor(
    existingPatient,
    requestId,
    MedicalDataSource.CAREQUALITY,
    pdStateAcrossHies
  );
  runOrScheduleCqPatientDiscovery({
    patient: existingPatient,
    facilityId,
    requestId,
    rerunPdOnNewDemographics,
    forceCarequality,
  })
    .then(postCqPdProcessor)
    .catch(processAsyncError("runOrScheduleCqPatientDiscovery"));

  // COMMONWELL
  const postCwPdProcessor = getPostPdProcessor(
    existingPatient,
    requestId,
    MedicalDataSource.COMMONWELL,
    pdStateAcrossHies
  );
  runOrScheduleCwPatientDiscovery({
    patient: existingPatient,
    facilityId,
    requestId,
    getOrgIdExcludeList: () => Promise.resolve([]),
    rerunPdOnNewDemographics,
    forceCommonwell,
  })
    .then(postCwPdProcessor)
    .catch(processAsyncError("runOrScheduleCwPatientDiscovery"));
}

function getPostPdProcessor(
  patient: Patient,
  requestId: string,
  source: MedicalDataSource,
  pdStateAcrossHies: PdStateAcrossHies
) {
  return async (status: "triggered" | "disabled"): Promise<void> => {
    pdStateAcrossHies[source] = { status };
    if (
      pdStateAcrossHies[MedicalDataSource.CAREQUALITY]?.status === "disabled" &&
      pdStateAcrossHies[MedicalDataSource.COMMONWELL]?.status === "disabled"
    ) {
      const { log } = out(
        `postPdProcessor - cx ${patient.cxId}, patient ${patient.id} req ${requestId}`
      );
      log(
        `Finishing single patient import for ${source} (status: successful) - state: ${JSON.stringify(
          pdStateAcrossHies
        )}`
      );
      await finishSinglePatientImport({
        cxId: patient.cxId,
        patientId: patient.id,
        requestId,
        status: "successful",
      }).catch(processAsyncError("Failed to finish single patient import"));
    }
  };
}
