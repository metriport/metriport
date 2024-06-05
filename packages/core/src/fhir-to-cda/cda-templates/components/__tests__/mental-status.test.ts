import { faker } from "@faker-js/faker";
import { Bundle, Observation } from "@medplum/fhirtypes";
import path from "path";
import { removeEmptyFields } from "../../clinical-document/clinical-document";
import { xmlBuilder } from "../../clinical-document/shared";
import { buildMentalStatus } from "../mental-status";
import { makeObservation } from "./make-observation";
import { observationMentalStatus } from "./mental-status-examples";
import { createEmptyBundle, getXmlContentFromFile } from "./shared";
import _ from "lodash";

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

describe("buildMentalStatus", () => {
  it("does not pick up non-mental-status Observations", () => {
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
    const res = buildMentalStatus(bundle);
    const cleanedJsonObj = removeEmptyFields(res);
    const xmlRes = xmlBuilder.build(cleanedJsonObj);
    expect(xmlRes).toContain("44249-1");
    expect(xmlRes).toContain(observation.id);
    expect(xmlRes).not.toContain(observation2.id);
  });

  it("correctly maps a single mental status survey Observation", () => {
    bundle.entry?.push({ resource: observation });
    const filePath = path.join(__dirname, "./xmls/mental-status-section-single-survey.xml");
    const params = {
      observationId,
    };
    const xmlTemplate = _.template(getXmlContentFromFile(filePath));
    const xmlContent = xmlTemplate(params);
    const res = buildMentalStatus(bundle);
    const cleanedJsonObj = removeEmptyFields(res);
    const xmlRes = xmlBuilder.build(cleanedJsonObj);
    console.log(xmlContent);
    expect(xmlRes).toEqual(xmlContent);
  });
});
