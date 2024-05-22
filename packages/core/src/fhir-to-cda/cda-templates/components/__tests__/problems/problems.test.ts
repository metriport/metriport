import { faker } from "@faker-js/faker";
import { Bundle, Condition } from "@medplum/fhirtypes";
import fs from "fs";
import path from "path";
import { removeEmptyFields } from "../../../clinical-document/clinical-document";
import { xmlBuilder } from "../../../clinical-document/shared";
import { buildProblems } from "../../problems";
import { createEmptyBundle } from "../shared";
import { makeCondition } from "./make-condition";
import { conditionHyperlipidemia, conditionNicotine } from "./condition-examples";

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
  it("correctly maps a single Condition", () => {
    bundle.entry?.push({ resource: condition });

    const filePath = path.join(__dirname, "problems-section.xml");
    const xmlTemplate = fs.readFileSync(filePath, "utf8");

    /* eslint-disable @typescript-eslint/no-unused-vars */
    const params = {
      conditionId,
    };

    const xmlContent = eval("`" + xmlTemplate + "`");
    const res = buildProblems(bundle);
    const cleanedJsonObj = removeEmptyFields(res);
    const xmlRes = xmlBuilder.build(cleanedJsonObj);
    expect(xmlRes).toEqual(xmlContent);
  });

  it("correctly maps two Conditions", () => {
    bundle.entry?.push({ resource: condition });

    const conditionId2 = faker.string.uuid();
    const condition2 = makeCondition({
      id: conditionId2,
      /* eslint-disable @typescript-eslint/no-non-null-assertion */
      code: conditionHyperlipidemia.code!,
    });

    bundle.entry?.push({ resource: condition2 });

    const filePath = path.join(__dirname, "problems-section-2.xml");
    const xmlTemplate = fs.readFileSync(filePath, "utf8");

    /* eslint-disable @typescript-eslint/no-unused-vars */
    const params = {
      conditionId,
      conditionId2,
    };

    const xmlContent = eval("`" + xmlTemplate + "`");
    const res = buildProblems(bundle);
    const cleanedJsonObj = removeEmptyFields(res);
    const xmlRes = xmlBuilder.build(cleanedJsonObj);
    expect(xmlRes).toEqual(xmlContent);
  });
});
