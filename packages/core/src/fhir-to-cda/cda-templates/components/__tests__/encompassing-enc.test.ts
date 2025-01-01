import { faker } from "@faker-js/faker";
import { Bundle, Composition, Encounter, Location, Practitioner } from "@medplum/fhirtypes";
import _ from "lodash";
import path from "path";
import { removeEmptyFields } from "../../clinical-document/clinical-document";
import { xmlBuilder } from "../../clinical-document/shared";
import { buildEncompassingEncounter } from "../encompassing-encounter";
import { encounter1, location1, practitioner1 } from "./encounter-examples";
import { makeComposition } from "./make-composition";
import { makeEncounter, makeLocation, makePractitioner } from "./make-encounter";
import { createEmptyBundle, getXmlContentFromFile } from "./shared";

let encounterId: string;
let practitionerId: string;
let locationId: string;
let bundle: Bundle;
let encounter: Encounter;
let practitioner: Practitioner;
let location: Location;
let composition: Composition;

beforeAll(() => {
  encounterId = faker.string.uuid();
  practitionerId = faker.string.uuid();
  locationId = faker.string.uuid();

  encounter = makeEncounter(
    {
      ...encounter1,
      class: {
        system: "http://terminology.hl7.org/CodeSystem/v3-ActCode",
        code: "AMB",
      },
      type: [
        {
          coding: [
            {
              system: "http://snomed.info/sct",
              code: "162673000",
              display: "General examination of patient (procedure)",
            },
          ],
          text: "General examination of patient (procedure)",
        },
      ],
    },
    {
      enc: encounterId,
      pract: practitionerId,
      loc: locationId,
    }
  );
  practitioner = makePractitioner({ ...practitioner1, id: practitionerId });
  location = makeLocation({ ...location1, id: locationId });
  composition = makeComposition({ encId: encounterId, practId: practitionerId });
});

beforeEach(() => {
  bundle = createEmptyBundle();
  bundle.entry?.push({ resource: composition });
  bundle.entry?.push({ resource: encounter });
  bundle.entry?.push({ resource: practitioner });
  bundle.entry?.push({ resource: location });
});

describe.skip("buildEncompassingEncounter", () => {
  it("correctly maps the Encompassing Encounter", () => {
    const filePath = path.join(__dirname, "./xmls/encompassing-encounter.xml");
    const params = {
      encompassingEncId: encounterId,
      practitionerId,
      locationId,
    };
    const applyToTemplate = _.template(getXmlContentFromFile(filePath));
    const xmlContent = applyToTemplate(params);
    const res = buildEncompassingEncounter(bundle);
    const cleanedJsonObj = removeEmptyFields(res);
    const xmlRes = xmlBuilder.build(cleanedJsonObj);
    expect(xmlRes).toEqual(xmlContent);
  });
});
