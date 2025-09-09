import fs from "fs";
import path from "path";
import { getRxNormArtifact } from "./shared";
import { getFhirResourcesFromRxNormEntities } from "../rxnorm/fhir-converter";

describe("FHIR converter", () => {
  it("should convert dosage frequency to FHIR", async () => {
    const { response } = getRxNormArtifact("dosage-frequency");
    const resources = getFhirResourcesFromRxNormEntities(response.Entities ?? [], {
      confidenceThreshold: 0.1,
    });
    fs.writeFileSync(
      path.join(__dirname, "artifacts", "dosage-frequency/fhir.json"),
      JSON.stringify(resources, null, 2)
    );
  });
});
