import { faker } from "@faker-js/faker";
import _ from "lodash";
import { Bundle, AllergyIntolerance } from "@medplum/fhirtypes";
import path from "path";
import { removeEmptyFields } from "../../clinical-document/clinical-document";
import { xmlBuilder } from "../../clinical-document/shared";
import { buildAllergies } from "../allergies";
import { allergyFood, allergyMedication } from "./allergy-examples";
import { makeAllergy } from "./make-allergy";
import { createEmptyBundle, getXmlContentFromFile } from "./shared";

let allergyId: string;
let bundle: Bundle;
let allergy: AllergyIntolerance;

beforeAll(() => {
  allergyId = faker.string.uuid();
  allergy = makeAllergy({
    id: allergyId,
    ...allergyMedication,
  });
});

beforeEach(() => {
  bundle = createEmptyBundle();
});

describe("buildAllergies", () => {
  it("correctly maps a single AllergyIntolerance", () => {
    bundle.entry?.push({ resource: { ...allergy, note: [] } });

    const filePath = path.join(__dirname, "./xmls/allergy-section-single-entry.xml");
    const applyToTemplate = _.template(getXmlContentFromFile(filePath));
    const xmlContent = applyToTemplate({ allergyId });
    const res = buildAllergies(bundle);
    const cleanedJsonObj = removeEmptyFields(res);
    const xmlRes = xmlBuilder.build(cleanedJsonObj);
    expect(xmlRes).toEqual(xmlContent);
  });

  it("correctly maps two AllergyIntolerances", () => {
    bundle.entry?.push({ resource: allergy });

    const allergyId2 = faker.string.uuid();
    const allergy2 = makeAllergy({
      id: allergyId2,
      ...allergyFood,
    });

    bundle.entry?.push({ resource: allergy2 });
    const filePath = path.join(__dirname, "./xmls/allergy-section-two-entries.xml");

    const params = {
      allergyId,
      allergyId2,
    };
    const applyToTemplate = _.template(getXmlContentFromFile(filePath));
    const xmlContent = applyToTemplate(params);
    const res = buildAllergies(bundle);
    const cleanedJsonObj = removeEmptyFields(res);
    const xmlRes = xmlBuilder.build(cleanedJsonObj);
    expect(xmlRes).toEqual(xmlContent);
  });
});
