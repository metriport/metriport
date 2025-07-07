import { Command } from "commander";
import fs from "fs";
import path from "path";
import { SurescriptsConvertPatientResponseHandlerDirect } from "@metriport/core/external/surescripts/command/convert-patient-response/convert-patient-response-direct";
import { SurescriptsReplica } from "@metriport/core/external/surescripts/replica";
import { buildCsvPath, getTransmissionsFromCsv } from "../shared";
import { DR_FIRST_DIR, getPatientIdMapping } from "./dr-first";
import { Bundle } from "@medplum/fhirtypes";

const program = new Command();
const CX_ID = process.env.TARGET_COMPARISON_CX_ID ?? "";
const FACILITY_ID = process.env.TARGET_COMPARISON_FACILITY_ID ?? "";

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
    const transmissions = await getTransmissionsFromCsv(CX_ID, buildCsvPath("wellpath_round2.csv"));

    for (const { transmissionId, patientId } of transmissions) {
      console.log(`Converting ${patientId}/jobId=${transmissionId}`);
      const conversion = await handler.convertPatientResponse({
        cxId: CX_ID,
        facilityId: FACILITY_ID,
        transmissionId,
        populationId: patientId,
      });
      if (!conversion) {
        console.log("No conversion");
        continue;
      }
      console.log("Done converting");
      const nameId = nameIdMapping[patientId];
      if (!nameId) {
        console.log("No nameId");
        continue;
      }
      writeLocalBundle(nameId, conversion.bundle);
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
