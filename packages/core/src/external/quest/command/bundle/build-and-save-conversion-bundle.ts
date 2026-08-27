import { Bundle } from "@medplum/fhirtypes";
import { QuestRosterType } from "@metriport/shared/interface/external/quest/roster";
import { questSource } from "@metriport/shared/interface/external/quest/source";
import { updateNetworkQueryStatus } from "../../../../command/network-query";
import { processAsyncError } from "../../../../util/error/shared";
import { out } from "../../../../util/log";
import { convertTabularDataToFhirBundle } from "../../fhir/bundle";
import { ResponseDetail } from "../../schema/response";
import { IncomingData } from "../../schema/shared";
import { saveLabConversionBundle } from "../convert-patient-response/utils";

export type BuildAndSaveConversionBundleParams = {
  cxId: string;
  patientId: string;
  rows: IncomingData<ResponseDetail>[];
  dateId: string;
  rosterType: QuestRosterType;
};

export type BuildAndSaveConversionBundleResult = {
  bundle: Bundle;
};

/**
 * Converts Quest tabular data to FHIR, saves the conversion bundle to S3,
 * and updates the network query status to "converted".
 *
 * @param cxId - The customer ID
 * @param patientId - The patient ID
 * @param rows - The parsed tabular rows from Quest response
 * @param dateId - The date ID for the response
 * @param rosterType - The roster type (backfill, weekly-backfill, etc.)
 * @returns The converted FHIR bundle
 */
export async function buildAndSaveConversionBundle({
  cxId,
  patientId,
  rows,
  dateId,
  rosterType,
}: BuildAndSaveConversionBundleParams): Promise<BuildAndSaveConversionBundleResult> {
  const { log } = out(`quest.build-and-save-conversion-bundle - cx ${cxId}, pat ${patientId}`);

  const bundle = await convertTabularDataToFhirBundle({ cxId, patientId, rows, log });

  await saveLabConversionBundle({ bundle, cxId, patientId, dateId, rosterType });

  await updateNetworkQueryStatus({
    cxId,
    patientId,
    source: "lab",
    specificSource: questSource,
    toStatus: "converted",
  }).catch(processAsyncError("Failed to update network query status to converted", log));

  return { bundle };
}
