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

  it("does not group if dob is different or missing in one of the resources", () => {
    famMemHistory.bornDate = "1930-01-01";
    let result = groupSameFamilyMemberHistories([famMemHistory, famMemHistory2]);
    expect(result.famMemberHistsMap.size).toBe(2);

    famMemHistory.bornDate = "1930-01-01";
    famMemHistory2.bornDate = "1932-02-02";
    result = groupSameFamilyMemberHistories([famMemHistory, famMemHistory2]);
    expect(result.famMemberHistsMap.size).toBe(2);
  });

  it("does not group people with the same name if the relationship is different", () => {
    famMemHistory2.relationship = naturalBrotherCode;

    famMemHistory.bornDate = "1930-01-01";
    famMemHistory2.bornDate = "1930-01-01";

    const { famMemberHistsMap } = groupSameFamilyMemberHistories([famMemHistory, famMemHistory2]);
    expect(famMemberHistsMap.size).toBe(2);
  });

  it("transforms onsetAge correctly when unit is 'a' and value is 0", () => {
    famMemHistory.condition = [
      {
        code: {
          coding: [{ system: "http://snomed.info/sct", code: "5294002" }],
          text: "Developmental Disorder",
        },
        onsetAge: { value: 0, unit: "a", system: "http://unitsofmeasure.org", code: "unknown" },
      },
    ];

    const { famMemberHistsMap } = groupSameFamilyMemberHistories([famMemHistory]);
    const updatedFamMemHistory = famMemberHistsMap.values().next().value;

    expect(updatedFamMemHistory.condition[0].onsetAge.value).toBe(1);
    expect(updatedFamMemHistory.condition[0].onsetAge.unit).toBe("Day");
  });
});
