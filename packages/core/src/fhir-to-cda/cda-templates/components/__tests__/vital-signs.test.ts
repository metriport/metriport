import { faker } from "@faker-js/faker";
import { Bundle, Observation } from "@medplum/fhirtypes";
import _ from "lodash";
import path from "path";
import { removeEmptyFields } from "../../clinical-document/clinical-document";
import { xmlBuilder } from "../../clinical-document/shared";
import { buildVitalSigns } from "../vital-signs";
import { makeObservation } from "./make-observation";
import { createEmptyBundle, getXmlContentFromFile } from "./shared";
import {
  vitalSignObservationTemplate,
  obsHeartRate,
  obsTemperature,
  obsRespiratoryRate,
  obsHeight,
  obsWeight,
  obsSystolic,
  obsDiastolic,
} from "./vital-signs-examples";

let observationId: string;
let bundle: Bundle;
let observation: Observation;

beforeEach(() => {
  observationId = faker.string.uuid();
  observation = makeObservation({
    id: observationId,
    ...vitalSignObservationTemplate,
  });

  bundle = createEmptyBundle();
});

describe("buildVitalSigns", () => {
  it("does not pick up non-vital-signs Observations", () => {
    bundle.entry?.push({ resource: observation });
    const observation2 = makeObservation({
      ...vitalSignObservationTemplate,
      id: faker.string.uuid(),
      category: [
        {
          coding: [
            {
              system: "http://terminology.hl7.org/CodeSystem/observation-category",
              code: "some-other-observation-type",
              display: "Some other observation type",
            },
          ],
        },
      ],
    });
    bundle.entry?.push({ resource: observation2 });
    const res = buildVitalSigns(bundle);
    const cleanedJsonObj = removeEmptyFields(res);
    const xmlRes = xmlBuilder.build(cleanedJsonObj);
    expect(xmlRes).toContain(observation.id);
    expect(xmlRes).not.toContain(observation2.id);
  });

  it("correctly maps a vital-signs Observation", () => {
    bundle.entry?.push({ resource: observation });
    const filePath = path.join(__dirname, "./xmls/vital-signs-single-entry.xml");
    const params = {
      observationId,
    };
    const xmlTemplate = _.template(getXmlContentFromFile(filePath));
    const xmlContent = xmlTemplate(params);
    const res = buildVitalSigns(bundle);
    const cleanedJsonObj = removeEmptyFields(res);
    const xmlRes = xmlBuilder.build(cleanedJsonObj);
    expect(xmlRes).toEqual(xmlContent);
  });

  it("correctly maps and groups a handful of vital-signs Observations taken on the same date", () => {
    bundle.entry?.push({ resource: observation });
    const observationId2 = faker.string.uuid();
    const observationId3 = faker.string.uuid();
    const observationId4 = faker.string.uuid();
    bundle.entry?.push({ resource: { ...observation, id: observationId2, ...obsHeartRate } });
    bundle.entry?.push({ resource: { ...observation, id: observationId3, ...obsTemperature } });
    bundle.entry?.push({ resource: { ...observation, id: observationId4, ...obsRespiratoryRate } });

    const filePath = path.join(__dirname, "./xmls/vital-signs-multiple-entries-same-date.xml");
    const params = {
      observationId,
      observationId2,
      observationId3,
      observationId4,
    };
    const xmlTemplate = _.template(getXmlContentFromFile(filePath));
    const xmlContent = xmlTemplate(params);
    const res = buildVitalSigns(bundle);
    const cleanedJsonObj = removeEmptyFields(res);
    const xmlRes = xmlBuilder.build(cleanedJsonObj);
    expect(xmlRes).toEqual(xmlContent);
  });

  it("correctly maps and groups a handful of vital-signs Observations taken on different dates", () => {
    bundle.entry?.push({ resource: observation });
    const observationId2 = faker.string.uuid();
    const observationId3 = faker.string.uuid();
    const observationId4 = faker.string.uuid();
    const observationId5 = faker.string.uuid();
    const observationId6 = faker.string.uuid();
    const observationId7 = faker.string.uuid();
    const observationId8 = faker.string.uuid();
    bundle.entry?.push({ resource: { ...observation, id: observationId2, ...obsHeartRate } });
    bundle.entry?.push({ resource: { ...observation, id: observationId3, ...obsTemperature } });
    bundle.entry?.push({ resource: { ...observation, id: observationId4, ...obsRespiratoryRate } });
    bundle.entry?.push({ resource: { ...observation, id: observationId5, ...obsWeight } });
    bundle.entry?.push({ resource: { ...observation, id: observationId6, ...obsSystolic } });
    bundle.entry?.push({ resource: { ...observation, id: observationId7, ...obsDiastolic } });
    bundle.entry?.push({ resource: { ...observation, id: observationId8, ...obsHeight } });

    const filePath = path.join(__dirname, "./xmls/vital-signs-with-different-dates.xml");
    const params = {
      observationId,
      observationId2,
      observationId3,
      observationId4,
      observationId5,
      observationId6,
      observationId7,
      observationId8,
    };
    const xmlTemplate = _.template(getXmlContentFromFile(filePath));
    const xmlContent = xmlTemplate(params);
    const res = buildVitalSigns(bundle);
    const cleanedJsonObj = removeEmptyFields(res);
    const xmlRes = xmlBuilder.build(cleanedJsonObj);
    expect(xmlRes).toEqual(xmlContent);
  });
});
