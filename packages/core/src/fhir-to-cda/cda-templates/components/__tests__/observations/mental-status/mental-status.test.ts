import { faker } from "@faker-js/faker";
import { Bundle, Observation } from "@medplum/fhirtypes";
import fs from "fs";
import path from "path";
import { removeEmptyFields } from "../../../../clinical-document/clinical-document";
import { xmlBuilder } from "../../../../clinical-document/shared";
import { buildMentalStatus } from "../../../mental-status";
import { createEmptyBundle } from "../../shared";
import { makeObservation } from "../make-observation";
import { observationMentalStatus } from "./mental-status-examples";

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

    const filePath = path.join(__dirname, "mental-status-section.xml");
    const xmlTemplate = fs.readFileSync(filePath, "utf8");

    /* eslint-disable @typescript-eslint/no-unused-vars */
    const params = {
      observationId,
    };

    const xmlContent = eval("`" + xmlTemplate + "`");
    const res = buildMentalStatus(bundle);
    const cleanedJsonObj = removeEmptyFields(res);
    const xmlRes = xmlBuilder.build(cleanedJsonObj);
    expect(xmlRes).toEqual(xmlContent);
  });

  // it("correctly maps two observations with notes", () => {
  //   bundle.entry?.push({ resource: observation });

  //   const conditionId2 = faker.string.uuid();
  //   const condition2 = makeObservation({
  //     id: conditionId2,
  //     /* eslint-disable @typescript-eslint/no-non-null-assertion */
  //     code: observationMentalStatus.code!,
  //   });

  //   bundle.entry?.push({ resource: condition2 });

  //   const filePath = path.join(__dirname, "problems-section-2.xml");
  //   const xmlTemplate = fs.readFileSync(filePath, "utf8");

  //   /* eslint-disable @typescript-eslint/no-unused-vars */
  //   const params = {
  //     conditionId,
  //     conditionId2,
  //   };

  //   const xmlContent = eval("`" + xmlTemplate + "`");
  //   const res = buildProblems(bundle);
  //   const cleanedJsonObj = removeEmptyFields(res);
  //   const xmlRes = xmlBuilder.build(cleanedJsonObj);
  //   expect(xmlRes).toEqual(xmlContent);
  // });
});
