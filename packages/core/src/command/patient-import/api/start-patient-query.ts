import { errorToString, MetriportError } from "@metriport/shared";
import axios from "axios";
import { Config } from "../../../util/config";
import { out } from "../../../util/log";

// TODO 2330 add TSDoc
export async function startPatientQuery({
  cxId,
  patientId,
  rerunPdOnNewDemographics,
}: {
  cxId: string;
  patientId: string;
  rerunPdOnNewDemographics?: boolean | undefined;
}): Promise<void> {
  const { log, debug } = out(
    `PatientImport startPatientQuery - cxId ${cxId} patientId ${patientId}`
  );
  const api = axios.create({ baseURL: Config.getApiUrl() });
  const patientUrl = buildPatientDiscoveryUrl(cxId, patientId, rerunPdOnNewDemographics);
  try {
    const response = await api.post(patientUrl, {});
    if (!response.data) throw new Error(`No body returned from ${patientUrl}`);
    debug(`${patientUrl} resp: ${JSON.stringify(response.data)}`);
  } catch (error) {
    const msg = `Failure while starting patient query @ PatientImport`;
    log(`${msg}. Cause: ${errorToString(error)}`);
    throw new MetriportError(msg, error, {
      url: patientUrl,
      cxId,
      patientId,
      rerunPdOnNewDemographics,
      context: "patient-import.startPatientQuery",
    });
  }
}

function buildPatientDiscoveryUrl(
  cxId: string,
  patientId: string,
  rerunPdOnNewDemographics?: boolean | undefined
) {
  const urlParams = new URLSearchParams({
    cxId,
    ...(rerunPdOnNewDemographics
      ? { rerunPdOnNewDemographics: rerunPdOnNewDemographics.toString() }
      : undefined),
  });
  return `/internal/patient/${patientId}/patient-discovery?${urlParams.toString()}`;
}
