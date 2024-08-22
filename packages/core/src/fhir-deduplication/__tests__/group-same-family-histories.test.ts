import { faker } from "@faker-js/faker";
import { FamilyMemberHistory } from "@medplum/fhirtypes";
import { groupSameFamilyMemberHistories } from "../resources/family-member-history";
import {
  makeFamilyMemberHistory,
  naturalBrotherCode,
} from "../../fhir-to-cda/cda-templates/components/__tests__/make-family-member-history";

let famMemHistoryId: string;
let famMemHistoryId2: string;
let famMemHistory: FamilyMemberHistory;
let famMemHistory2: FamilyMemberHistory;

beforeEach(() => {
  famMemHistoryId = faker.string.uuid();
  famMemHistoryId2 = faker.string.uuid();
  famMemHistory = makeFamilyMemberHistory({ id: famMemHistoryId });
  famMemHistory2 = makeFamilyMemberHistory({ id: famMemHistoryId2 });
});

describe("groupSameFamilyMemberHistories", () => {
  it("correctly groups duplicate famMemHistorys based on relationship", () => {
    const { famMemberHistsMap } = groupSameFamilyMemberHistories([famMemHistory, famMemHistory2]);
    expect(famMemberHistsMap.size).toBe(1);
  });

  it("correctly groups duplicate famMemHistorys based on relationship", () => {
    famMemHistory.bornDate = "1930-01-01";
    const { famMemberHistsMap } = groupSameFamilyMemberHistories([famMemHistory, famMemHistory2]);
    expect(famMemberHistsMap.size).toBe(1);
  });

  it("correctly groups duplicate famMemHistorys based on relationship", () => {
    famMemHistory.bornDate = "1930-01-01";

    famMemHistory.name = "Stephen";
    famMemHistory2.name = "Steven";
    const { famMemberHistsMap } = groupSameFamilyMemberHistories([famMemHistory, famMemHistory2]);
    expect(famMemberHistsMap.size).toBe(1);
    const masterFather = famMemberHistsMap.values().next().value as FamilyMemberHistory;
    expect(masterFather.name).toEqual("Steven");
    expect(masterFather.bornDate).toEqual("1930-01-01");
  });

  it("correctly groups duplicate famMemHistorys based on relationship", () => {
    famMemHistory.relationship = naturalBrotherCode;
    famMemHistory2.relationship = naturalBrotherCode;

    famMemHistory.name = "Harry";
    famMemHistory2.name = "Gary";

    const { famMemberHistsMap } = groupSameFamilyMemberHistories([famMemHistory, famMemHistory2]);
    expect(famMemberHistsMap.size).toBe(2);
  });
});
