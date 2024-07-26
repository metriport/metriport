import { faker } from "@faker-js/faker";
import { Bundle, FamilyMemberHistory, FamilyMemberHistoryCondition } from "@medplum/fhirtypes";
import _ from "lodash";
import path from "path";
import { removeEmptyFields } from "../../clinical-document/clinical-document";
import { xmlBuilder } from "../../clinical-document/shared";
import { buildFamilyHistory } from "../family-history";
import { conditionHeartAttack, conditionStroke } from "./condition-examples";
import { makeCondition } from "./make-condition";
import { makeFamilyMemberHistory, motherFamilyMemberHistory } from "./make-family-member-history";
import { createEmptyBundle, getXmlContentFromFile } from "./shared";

let memberHistId: string;
let bundle: Bundle;
let memberHist: FamilyMemberHistory;
let condition: FamilyMemberHistoryCondition;
let condition2: FamilyMemberHistoryCondition;

beforeAll(() => {
  memberHistId = faker.string.uuid();
  memberHist = makeFamilyMemberHistory({ id: memberHistId });
  condition = makeCondition(conditionHeartAttack);
  condition2 = makeCondition(conditionStroke);
});

beforeEach(() => {
  bundle = createEmptyBundle();
});

describe.skip("buildMedications", () => {
  it("correctly maps a single FamilyMemberHistory without Conditions", () => {
    bundle.entry?.push({ resource: { ...memberHist } });
    const filePath = path.join(
      __dirname,
      "./xmls/family-history-single-relative-no-conditions.xml"
    );
    const params = { memberHistId };
    const applyToTemplate = _.template(getXmlContentFromFile(filePath));
    const xmlContent = applyToTemplate(params);
    const res = buildFamilyHistory(bundle);
    const cleanedJsonObj = removeEmptyFields(res);
    const xmlRes = xmlBuilder.build(cleanedJsonObj);
    expect(xmlRes).toEqual(xmlContent);
  });

  it("correctly maps a single FamilyMemberHistory with two Conditions", () => {
    bundle.entry?.push({ resource: { ...memberHist, condition: [condition, condition2] } });
    const filePath = path.join(__dirname, "./xmls/family-history-single-relative.xml");
    const params = { memberHistId };
    const applyToTemplate = _.template(getXmlContentFromFile(filePath));
    const xmlContent = applyToTemplate(params);
    const res = buildFamilyHistory(bundle);
    const cleanedJsonObj = removeEmptyFields(res);
    const xmlRes = xmlBuilder.build(cleanedJsonObj);
    expect(xmlRes).toEqual(xmlContent);
  });

  it("correctly maps two FamilyMemberHistories", () => {
    bundle.entry?.push({ resource: { ...memberHist, condition: [condition] } });

    const memberHistId2 = faker.string.uuid();
    const memberHist2 = makeFamilyMemberHistory({
      id: memberHistId2,
      ...motherFamilyMemberHistory,
    });
    bundle.entry?.push({ resource: { ...memberHist2, condition: [condition2] } });

    const filePath = path.join(__dirname, "./xmls/family-history-two-relatives.xml");
    const params = { memberHistId, memberHistId2 };
    const applyToTemplate = _.template(getXmlContentFromFile(filePath));
    const xmlContent = applyToTemplate(params);
    const res = buildFamilyHistory(bundle);
    const cleanedJsonObj = removeEmptyFields(res);
    const xmlRes = xmlBuilder.build(cleanedJsonObj);
    expect(xmlRes).toEqual(xmlContent);
  });
});
