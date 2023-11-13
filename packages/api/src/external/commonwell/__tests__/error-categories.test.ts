/* eslint-disable @typescript-eslint/no-empty-function */
import { faker } from "@faker-js/faker";
import { OperationOutcome } from "@metriport/commonwell-sdk";
import { errorCategories, ErrorCategory, groupCWErrors } from "../error-categories";

const makeOperationOutcomeError = (category?: ErrorCategory): OperationOutcome => {
  return {
    id: "1",
    content: {
      resourceType: "OperationOutcome",
      issue: [
        {
          severity: "error",
          type: { code: "invalid" },
          details: `Something: ${category} Invalid patient identifier`,
        },
        {
          severity: "error",
          type: { code: "invalid" },
          details: `Something: regular Invalid patient identifier`,
        },
      ],
    },
  };
};

describe("groupCWErrors", () => {
  it("returns categories of each error", async () => {
    const cat1 = "Too many results found";
    const cat2 = faker.helpers.arrayElement(errorCategories.slice(1));
    const errors = [
      makeOperationOutcomeError(cat1),
      makeOperationOutcomeError(cat2),
      makeOperationOutcomeError(cat2),
      makeOperationOutcomeError(cat1),
    ];
    const res = groupCWErrors(errors);
    expect(res).toBeTruthy();
    expect(res[cat1]).toBeTruthy();
    expect(res[cat2]).toBeTruthy();
  });

  it("returns all issues of each error of a category", async () => {
    const cat = "Too many results found";
    const errors = [makeOperationOutcomeError(cat), makeOperationOutcomeError(cat)];
    const res = groupCWErrors(errors);
    expect(res).toBeTruthy();
    expect(res[cat]).toBeTruthy();
    const expectedIssues = errors
      .flatMap(err => err.content.issue ?? [])
      .filter(issue => issue.details.includes(cat));
    expect(res[cat]).toEqual(expectedIssues);
  });

  it("returns unkown category when unmapped error", async () => {
    const cat = "Too many results found";
    const errors = [
      makeOperationOutcomeError(cat),
      makeOperationOutcomeError(),
      makeOperationOutcomeError(cat),
    ];
    const res = groupCWErrors(errors);
    expect(res).toBeTruthy();
    expect(res[cat]).toBeTruthy();
    expect(res["Metriport could not determine"]).toBeTruthy();
    (errors[1]?.content.issue ?? []).forEach(issue => {
      expect(res["Metriport could not determine"]).toEqual(
        expect.arrayContaining([expect.objectContaining(issue)])
      );
    });
  });
});
