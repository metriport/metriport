import { Bundle } from "@medplum/fhirtypes";
import { SurescriptsRosterType } from "@metriport/shared/interface/external/surescripts/roster";
import { surescriptsSource } from "@metriport/shared/interface/external/surescripts/source";
import { updateNetworkQueryStatus } from "../../../../command/network-query";
import { processAsyncError } from "../../../../util/error/shared";
import { out } from "../../../../util/log";
import { convertIncomingDataToFhirBundle } from "../../fhir/bundle";
import { ResponseDetail } from "../../schema/response";
import { IncomingData } from "../../schema/shared";
import { savePharmacyConversionBundle } from "../convert-patient-response/utils";
import { DatasourceQueryStatus } from "@metriport/shared/domain/network-query/source";

export type BuildAndSaveConversionBundleParams = {
  cxId: string;
  patientId: string;
  details: IncomingData<ResponseDetail>[];
  rosterId: string;
  rosterType: SurescriptsRosterType;
};

export type BuildAndSaveConversionBundleResult = {
  bundle: Bundle;
};

/**
 * Converts Surescripts response data to FHIR, saves the conversion bundle to S3,
 * and updates the network query status to "converted".
 *
 * @param cxId - The customer ID
 * @param patientId - The patient ID
 * @param details - The parsed response details from Surescripts
 * @param rosterId - The roster/population ID
 * @param rosterType - The type of roster (backfill, notification, etc.)
 * @returns The converted FHIR bundle
 */
export async function buildAndSaveConversionBundle({
  cxId,
  patientId,
  details,
  rosterId,
  rosterType,
}: BuildAndSaveConversionBundleParams): Promise<BuildAndSaveConversionBundleResult> {
  const { log } = out(
    `surescripts.build-and-save-conversion-bundle - cx ${cxId}, pat ${patientId}`
  );

  const bundle = await convertIncomingDataToFhirBundle({ cxId, patientId, details });

  await savePharmacyConversionBundle({ bundle, cxId, patientId, rosterId, rosterType });

  await updateNetworkQueryStatus({
    cxId,
    patientId,
    source: "pharmacy",
    specificSource: surescriptsSource,
    toStatus: DatasourceQueryStatus.Converted,
    rosterId,
  }).catch(processAsyncError("Failed to update network query status to converted", log));

  return { bundle };
}
