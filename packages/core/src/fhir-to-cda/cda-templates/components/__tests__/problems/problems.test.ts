import { faker } from "@faker-js/faker";
import { Bundle, Condition } from "@medplum/fhirtypes";
import path from "path";
import { removeEmptyFields } from "../../../clinical-document/clinical-document";
import { xmlBuilder } from "../../../clinical-document/shared";
import { buildProblems } from "../../problems";
import { createEmptyBundle, getXmlContentFromFile } from "../shared";
import { conditionHyperlipidemia, conditionNicotine } from "./condition-examples";
import { makeCondition } from "./make-condition";

let conditionId: string;
let bundle: Bundle;
let condition: Condition;

beforeEach(() => {
  conditionId = faker.string.uuid();
  condition = makeCondition({
    id: conditionId,
    /* eslint-disable @typescript-eslint/no-non-null-assertion */
    note: conditionNicotine.note!,
  });

  bundle = createEmptyBundle();
});

describe("buildProblems", () => {
  it("correctly includes the text note into the Problems table", () => {
    bundle.entry?.push({ resource: condition });
    const res = buildProblems(bundle);
    const cleanedJsonObj = removeEmptyFields(res);
    const xmlRes = xmlBuilder.build(cleanedJsonObj);
    /* eslint-disable @typescript-eslint/no-non-null-assertion */
    expect(xmlRes).toContain(`<td>${conditionNicotine.note![0]?.text}</td>`);
  });

  it("correctly maps a single Condition without a note", () => {
    bundle.entry?.push({ resource: { ...condition, note: [] } });

    const filePath = path.join(__dirname, "problems-section.xml");

    /* eslint-disable @typescript-eslint/no-unused-vars */
    const params = {
      conditionId,
    };
    // TODO: Remove the console.log after we fix the tsconfig to ignore "unused" vars,
    // since `eval()` isn't explicitly using them
    console.log("params", params);

    const xmlContent = eval("`" + getXmlContentFromFile(filePath) + "`");
    const res = buildProblems(bundle);
    const cleanedJsonObj = removeEmptyFields(res);
    const xmlRes = xmlBuilder.build(cleanedJsonObj);
    expect(xmlRes).toEqual(xmlContent);
  });

  it("correctly maps two Conditions with notes", () => {
    bundle.entry?.push({ resource: condition });

    const conditionId2 = faker.string.uuid();
    const condition2 = makeCondition({
      id: conditionId2,
      /* eslint-disable @typescript-eslint/no-non-null-assertion */
      code: conditionHyperlipidemia.code!,
    });

    bundle.entry?.push({ resource: condition2 });
    const filePath = path.join(__dirname, "problems-section-2.xml");

    /* eslint-disable @typescript-eslint/no-unused-vars */
    const params = {
      conditionId,
      conditionId2,
    };
    // TODO: Remove the console.log after we fix the tsconfig to ignore "unused" vars,
    // since `eval()` isn't explicitly using them
    console.log("params", params);

    const xmlContent = eval("`" + getXmlContentFromFile(filePath) + "`");
    const res = buildProblems(bundle);
    const cleanedJsonObj = removeEmptyFields(res);
    const xmlRes = xmlBuilder.build(cleanedJsonObj);
    expect(xmlRes).toEqual(xmlContent);
  });
});
