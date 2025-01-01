import { faker } from "@faker-js/faker";
import { Bundle, Observation } from "@medplum/fhirtypes";
import path from "path";
import { removeEmptyFields } from "../../clinical-document/clinical-document";
import { xmlBuilder } from "../../clinical-document/shared";
import { buildSocialHistory } from "../social-history";
import { makeObservation } from "./make-observation";
import { createEmptyBundle, getXmlContentFromFile } from "./shared";
import { observationSocialHistory } from "./social-history-examples";
import _ from "lodash";

let observationId: string;
let bundle: Bundle;
let observation: Observation;

beforeAll(() => {
  observationId = faker.string.uuid();
  observation = makeObservation({
    id: observationId,
    ...observationSocialHistory,
  });
});

beforeEach(() => {
  bundle = createEmptyBundle();
  bundle.entry?.push({ resource: observation });
});

describe.skip("buildSocialHistory", () => {
  it("does not pick up non-social-history Observations", () => {
    const observation2 = makeObservation({
      ...observationSocialHistory,
      id: faker.string.uuid(),
      category: [
        {
          coding: [
            {
              system: "http://terminology.hl7.org/CodeSystem/observation-category",
              code: "survey",
              display: "survey",
            },
          ],
        },
      ],
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
    const filePath = path.join(__dirname, "./xmls/social-history-section-single-survey.xml");
    const params = {
      observationId,
    };
    const applyToTemplate = _.template(getXmlContentFromFile(filePath));
    const xmlContent = applyToTemplate(params);
    const res = buildSocialHistory(bundle);
    const cleanedJsonObj = removeEmptyFields(res);
    const xmlRes = xmlBuilder.build(cleanedJsonObj);
    expect(xmlRes).toEqual(xmlContent);
  });
});
