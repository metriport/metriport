import fs from "fs";
import path from "path";
import { faker } from "@faker-js/faker";
import { getRxNormArtifact } from "./shared";
import { getFhirResourcesFromRxNormEntities } from "../rxnorm/fhir-converter";
import { buildDayjs } from "@metriport/shared/common/date";

describe("FHIR converter", () => {
  it("should convert dosage frequency to FHIR", async () => {
    const artifactId = "negation-trait";
    const { inputText, response } = getRxNormArtifact(artifactId);
    const resources = getFhirResourcesFromRxNormEntities(response.Entities ?? [], {
      confidenceThreshold: 0.1,
      context: {
        patientId: "123",
        dateNoteWritten: buildDayjs("2025-01-01").toISOString(),
        originalText: inputText,
        encounterId: faker.string.uuid(),
      },
    });

    fs.writeFileSync(
      path.join(__dirname, "artifacts", artifactId, "fhir.json"),
      JSON.stringify(resources, null, 2)
    );
  });
});
