import { faker } from "@faker-js/faker";
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

beforeEach(() => {
  allergyId = faker.string.uuid();
  allergy = makeAllergy({
    id: allergyId,
    ...allergyMedication,
  });

  bundle = createEmptyBundle();
});

describe("buildAllergies", () => {
  it("correctly includes the text note into the Problems table", () => {
    // bundle.entry?.push({ resource: allergy });
    // const res = buildAllergies(bundle);
    // const cleanedJsonObj = removeEmptyFields(res);
    // const xmlRes = xmlBuilder.build(cleanedJsonObj);
    // /* eslint-disable @typescript-eslint/no-non-null-assertion */
    // expect(xmlRes).toContain(`<td>${conditionNicotine.note![0]?.text}</td>`);
  });

  it("correctly maps a single AllergyIntolerance", () => {
    bundle.entry?.push({ resource: { ...allergy, note: [] } });

    const filePath = path.join(__dirname, "./xmls/problems-section-single-entry.xml");

    const params = {
      conditionId: allergyId,
    };
    // TODO: Remove the console.log after we fix the tsconfig to ignore "unused" vars,
    // since `eval()` isn't explicitly using them
    console.log("params", params);

    const xmlContent = eval("`" + getXmlContentFromFile(filePath) + "`");
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
    const filePath = path.join(__dirname, "./xmls/problems-section-two-entries.xml");

    /* eslint-disable @typescript-eslint/no-unused-vars */
    const params = {
      allergyId,
      allergyId2,
    };
    // TODO: Remove the console.log after we fix the tsconfig to ignore "unused" vars,
    // since `eval()` isn't explicitly using them
    console.log("params", params);

    const xmlContent = eval("`" + getXmlContentFromFile(filePath) + "`");
    const res = buildAllergies(bundle);
    const cleanedJsonObj = removeEmptyFields(res);
    const xmlRes = xmlBuilder.build(cleanedJsonObj);
    expect(xmlRes).toEqual(xmlContent);
  });
});
