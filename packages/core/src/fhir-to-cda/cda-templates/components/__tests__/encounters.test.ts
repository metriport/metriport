import { faker } from "@faker-js/faker";
import { Bundle, Encounter, Location, Practitioner } from "@medplum/fhirtypes";
import _ from "lodash";
import path from "path";
import { removeEmptyFields } from "../../clinical-document/clinical-document";
import { xmlBuilder } from "../../clinical-document/shared";
import { buildEncounters } from "../encounters";
import { encounter1, location1, practitioner1, practitioner2 } from "./encounter-examples";
import { makeEncounter, makeLocation, makePractitioner } from "./make-encounter";
import { createEmptyBundle, getXmlContentFromFile } from "./shared";

let encounterId: string;
let practitionerId: string;
let locationId: string;
let bundle: Bundle;
let encounter: Encounter;
let practitioner: Practitioner;
let location: Location;

beforeAll(() => {
  encounterId = faker.string.uuid();
  practitionerId = faker.string.uuid();
  locationId = faker.string.uuid();

  encounter = makeEncounter(
    { ...encounter1 },
    {
      enc: encounterId,
      pract: practitionerId,
      loc: locationId,
    }
  );
  practitioner = makePractitioner({ ...practitioner1, id: practitionerId });
  location = makeLocation({ ...location1, id: locationId });
});

beforeEach(() => {
  bundle = createEmptyBundle();
  bundle.entry?.push({ resource: encounter });
  bundle.entry?.push({ resource: practitioner });
  bundle.entry?.push({ resource: location });
});

describe("buildEncounters", () => {
  it("correctly maps a single Encounter", () => {
    const filePath = path.join(__dirname, "./xmls/encounters-section-single-entry.xml");
    const params = {
      encounterId,
      practitionerId,
      locationId,
    };
    const applyToTemplate = _.template(getXmlContentFromFile(filePath));
    const xmlContent = applyToTemplate(params);
    const res = buildEncounters(bundle);
    const cleanedJsonObj = removeEmptyFields(res);
    const xmlRes = xmlBuilder.build(cleanedJsonObj);
    expect(xmlRes).toEqual(xmlContent);
  });

  it("correctly maps a single Encounter with two practitioners", () => {
    bundle = createEmptyBundle();
    const practitionerId2 = faker.string.uuid();
    const secondPractitioner = makePractitioner({ ...practitioner2, id: practitionerId2 });

    encounter.participant?.push({ individual: { reference: `Practitioner/${practitionerId2}` } });
    bundle.entry?.push({ resource: encounter });
    bundle.entry?.push({ resource: practitioner });
    bundle.entry?.push({ resource: location });
    bundle.entry?.push({ resource: secondPractitioner });

    const res = buildEncounters(bundle);
    const cleanedJsonObj = removeEmptyFields(res);
    const xmlRes = xmlBuilder.build(cleanedJsonObj);
    expect(xmlRes).toContain(`MD Zoidberg, John A.; MD Farnsworth, Hubert`);
    expect(xmlRes).toContain(
      `<assignedPerson><name><given>Hubert, MD</given><family>Farnsworth</family></name></assignedPerson>`
    );
    expect(xmlRes).toContain(practitionerId2);
  });

  it("correctly maps two Encounters", () => {
    const encounterId2 = faker.string.uuid();
    const practitionerId2 = faker.string.uuid();
    const locationId2 = faker.string.uuid();
    const encounter2 = makeEncounter(
      {
        ...encounter1,
      },
      {
        enc: encounterId2,
        pract: practitionerId2,
        loc: locationId2,
      }
    );
    const practitioner2 = makePractitioner({ ...practitioner1, id: practitionerId2 });
    const location2 = makeLocation({ ...location1, id: locationId2 });
    bundle.entry?.push({ resource: encounter2 });
    bundle.entry?.push({ resource: practitioner2 });
    bundle.entry?.push({ resource: location2 });

    const filePath = path.join(__dirname, "./xmls/encounters-section-two-entries.xml");

    const params = {
      encounterId,
      practitionerId,
      locationId,
      encounterId2,
      practitionerId2,
      locationId2,
    };
    const applyToTemplate = _.template(getXmlContentFromFile(filePath));
    const xmlContent = applyToTemplate(params);
    const res = buildEncounters(bundle);
    const cleanedJsonObj = removeEmptyFields(res);
    const xmlRes = xmlBuilder.build(cleanedJsonObj);
    expect(xmlRes).toEqual(xmlContent);
  });
});
