import { Command } from "commander";
import fs from "fs";
import path from "path";
import { SurescriptsConvertPatientResponseHandlerDirect } from "@metriport/core/external/surescripts/command/convert-patient-response/convert-patient-response-direct";
import { SurescriptsReplica } from "@metriport/core/external/surescripts/replica";
import { buildCsvPath, getTransmissionsFromCsv } from "../shared";
import { DR_FIRST_DIR, getPatientIdMapping } from "./dr-first";
import { getAllConversionBundleJobIds, writeLatestConversionBundle } from "../shared";
import { Bundle, BundleEntry } from "@medplum/fhirtypes";
import { buildBundle } from "@metriport/core/external/fhir/bundle/bundle";
import { dangerouslyDeduplicateFhir } from "@metriport/core/fhir-deduplication/deduplicate-fhir";

const program = new Command();
const CX_ID = process.env.TARGET_COMPARISON_CX_ID ?? "";
const FACILITY_ID = process.env.TARGET_COMPARISON_FACILITY_ID ?? "";
const CSV_PATH = process.env.TARGET_COMPARISON_CSV ?? "";

program
  .name("convert-dr-first")
  .description("Converts all DR First patient responses to FHIR bundles")
  .showHelpAfterError()
  .version("1.0.0")
  .action(async function () {
    const handler = new SurescriptsConvertPatientResponseHandlerDirect(new SurescriptsReplica());
    const start = Date.now();

    const patientIdMapping = getPatientIdMapping();
    const nameIdMapping = Object.fromEntries(
      Object.entries(patientIdMapping).map(([k, v]) => [v, k])
    );
    const transmissions = await getTransmissionsFromCsv(CX_ID, buildCsvPath(CSV_PATH));

    for (const { transmissionId, patientId } of transmissions) {
      const transmissionIds = await getAllConversionBundleJobIds(CX_ID, patientId);
      if (!transmissionIds.includes(transmissionId)) {
        throw new Error(`Invalid transmission ID ${transmissionId}`);
      }

      const entries: BundleEntry[] = [];
      for (const transmissionId of transmissionIds) {
        const conversion = await handler.convertPatientResponse({
          cxId: CX_ID,
          facilityId: FACILITY_ID,
          transmissionId,
          populationId: patientId,
        });
        if (conversion && conversion.bundle && conversion.bundle.entry) {
          entries.push(...conversion.bundle.entry);
        }
      }
      const bundle = buildBundle({ type: "collection", entries });
      dangerouslyDeduplicateFhir(bundle, CX_ID, patientId);
      await writeLatestConversionBundle(CX_ID, patientId, bundle);
      const nameId = nameIdMapping[patientId];
      writeLocalBundle(nameId, bundle);
      console.log(`Wrote bundle to local directory`);
    }
    const end = Date.now();
    console.log(`Conversion took ${end - start} ms`);
  });

function writeLocalBundle(nameId: string, bundle: Bundle) {
  const fullFilePath = path.join(DR_FIRST_DIR, "bundle", nameId + ".json");
  fs.writeFileSync(fullFilePath, JSON.stringify(bundle, null, 2), "utf-8");
}

export default program;
