import { faker } from "@faker-js/faker";
import { Bundle, Observation } from "@medplum/fhirtypes";
import path from "path";
import { removeEmptyFields } from "../../../../clinical-document/clinical-document";
import { xmlBuilder } from "../../../../clinical-document/shared";
import { buildSocialHistory } from "../../../social-history";
import { createEmptyBundle, getXmlContentFromFile } from "../../shared";
import { makeObservation } from "../make-observation";
import { observationMentalStatus } from "./social-history-examples";

let observationId: string;
let bundle: Bundle;
let observation: Observation;

beforeEach(() => {
  observationId = faker.string.uuid();
  observation = makeObservation({
    id: observationId,
    ...observationMentalStatus,
  });

  bundle = createEmptyBundle();
});

describe("buildSocialHistory", () => {
  it("does not pick up non-social-history Observations", () => {
    bundle.entry?.push({ resource: observation });
    const observation2 = makeObservation({
      ...observationMentalStatus,
      id: faker.string.uuid(),
      code: {
        coding: [
          {
            system: "http://loinc.org",
            code: "12345",
            display: "Some other observation",
          },
        ],
      },
    });
    bundle.entry?.push({ resource: observation2 });
    const res = buildSocialHistory(bundle);
    const cleanedJsonObj = removeEmptyFields(res);
    const xmlRes = xmlBuilder.build(cleanedJsonObj);
    expect(xmlRes).toContain("51306-5");
    expect(xmlRes).toContain(observation.id);
    expect(xmlRes).not.toContain(observation2.id);
  });

  it("correctly maps a single social-history survey Observation", () => {
    bundle.entry?.push({ resource: observation });
    const filePath = path.join(__dirname, "social-history-section-single-survey.xml");

    /* eslint-disable @typescript-eslint/no-unused-vars */
    const params = {
      observationId,
    };
    // TODO: Remove the console.log after we fix the tsconfig to ignore "unused" vars,
    // since `eval()` isn't explicitly using them
    console.log("params", params);

    const xmlContent = eval("`" + getXmlContentFromFile(filePath) + "`");
    const res = buildSocialHistory(bundle);
    const cleanedJsonObj = removeEmptyFields(res);
    const xmlRes = xmlBuilder.build(cleanedJsonObj);
    expect(xmlRes).toEqual(xmlContent);
  });
});
