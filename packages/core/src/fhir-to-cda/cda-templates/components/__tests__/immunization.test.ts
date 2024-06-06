import { faker } from "@faker-js/faker";
import { Bundle, Immunization, Location } from "@medplum/fhirtypes";
import _ from "lodash";
import path from "path";
import { removeEmptyFields } from "../../clinical-document/clinical-document";
import { xmlBuilder } from "../../clinical-document/shared";
import { buildImmunizations } from "../immunizations";
import { immunizationFlu } from "./immunizations-examples";
import { location1 } from "./encounter-examples";
import { makeImmunization } from "./make-immunization";
import { createEmptyBundle, getXmlContentFromFile } from "./shared";
import { makeLocation } from "./make-encounter";

let immunizationId: string;
let locationId: string;
let bundle: Bundle;
let immunization: Immunization;
let location: Location;

beforeEach(() => {
  immunizationId = faker.string.uuid();
  locationId = faker.string.uuid();
  immunization = makeImmunization({ ...immunizationFlu }, { imm: immunizationId, loc: locationId });
  location = makeLocation({ ...location1, id: locationId });
  bundle = createEmptyBundle();
});

describe("buildImmunizations", () => {
  it("correctly maps a single Immunization", () => {
    bundle.entry?.push({ resource: immunization });
    bundle.entry?.push({ resource: location });

    const filePath = path.join(__dirname, "./xmls/immunization-section-single-entry.xml");
    const xmlTemplate = _.template(getXmlContentFromFile(filePath));
    const params = {
      immunizationId,
      locationId,
    };
    const xmlContent = xmlTemplate(params);
    const res = buildImmunizations(bundle);
    const cleanedJsonObj = removeEmptyFields(res);
    const xmlRes = xmlBuilder.build(cleanedJsonObj);
    expect(xmlRes).toEqual(xmlContent);
  });
});
