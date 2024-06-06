import { faker } from "@faker-js/faker";
import { Bundle, Encounter, Practitioner, Location } from "@medplum/fhirtypes";
import path from "path";
import _ from "lodash";
import { removeEmptyFields } from "../../clinical-document/clinical-document";
import { xmlBuilder } from "../../clinical-document/shared";
import { buildEncounters } from "../encounters";
import { encounter1, practitioner1, location1 } from "./encounter-examples";
import { makeEncounter, makeLocation, makePractitioner } from "./make-encounter";
import { createEmptyBundle, getXmlContentFromFile } from "./shared";

let encounterId: string;
let practitionerId: string;
let locationId: string;
let bundle: Bundle;
let encounter: Encounter;
let practitioner: Practitioner;
let location: Location;

beforeEach(() => {
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

  bundle = createEmptyBundle();
});

describe("buildEncounters", () => {
  it("correctly maps a single Encounter", () => {
    bundle.entry?.push({ resource: encounter });
    bundle.entry?.push({ resource: practitioner });
    bundle.entry?.push({ resource: location });

    const filePath = path.join(__dirname, "./xmls/encounters-section-single-entry.xml");

    const params = {
      encounterId,
      practitionerId,
      locationId,
    };
    const xmlTemplate = _.template(getXmlContentFromFile(filePath));
    const xmlContent = xmlTemplate(params);
    const res = buildEncounters(bundle);
    const cleanedJsonObj = removeEmptyFields(res);
    const xmlRes = xmlBuilder.build(cleanedJsonObj);
    expect(xmlRes).toEqual(xmlContent);
  });

  it("correctly maps two Encounters", () => {
    bundle.entry?.push({ resource: encounter });
    bundle.entry?.push({ resource: practitioner });
    bundle.entry?.push({ resource: location });

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
    const xmlTemplate = _.template(getXmlContentFromFile(filePath));
    const xmlContent = xmlTemplate(params);
    const res = buildEncounters(bundle);
    const cleanedJsonObj = removeEmptyFields(res);
    const xmlRes = xmlBuilder.build(cleanedJsonObj);
    expect(xmlRes).toEqual(xmlContent);
  });
});
