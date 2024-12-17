import { faker } from "@faker-js/faker";
import { Immunization } from "@medplum/fhirtypes";
import { makeImmunization } from "../../fhir-to-cda/cda-templates/components/__tests__/make-immunization";
import { groupSameImmunizations } from "../resources/immunization";
import { cvxCodeFlu, ndcCodeFlu } from "./examples/immunization-examples";
import { dateTime, dateTime2 } from "./examples/condition-examples";

let immunizationId: string;
let immunizationId2: string;
let immunization: Immunization;
let immunization2: Immunization;

beforeEach(() => {
  immunizationId = faker.string.uuid();
  immunizationId2 = faker.string.uuid();
  immunization = makeImmunization({ id: immunizationId });
  immunization2 = makeImmunization({ id: immunizationId2 });
});

describe("groupSameImmunizations", () => {
  it("correctly groups immunizations based on cvx codes without dates", () => {
    immunization.vaccineCode = cvxCodeFlu;
    immunization2.vaccineCode = cvxCodeFlu;

    const { immunizationsMap } = groupSameImmunizations([immunization, immunization2]);
    expect(immunizationsMap.size).toBe(1);
  });

  it("correctly groups immunizations based on cvx codes and dates", () => {
    immunization.occurrenceDateTime = dateTime.start;
    immunization2.occurrenceDateTime = dateTime.start;
    immunization.vaccineCode = cvxCodeFlu;
    immunization2.vaccineCode = cvxCodeFlu;

    const { immunizationsMap } = groupSameImmunizations([immunization, immunization2]);
    expect(immunizationsMap.size).toBe(1);
  });

  it("correctly groups immunizations with the same code, where one is missing the date", () => {
    immunization.occurrenceDateTime = dateTime.start;
    immunization.vaccineCode = cvxCodeFlu;
    immunization2.vaccineCode = cvxCodeFlu;

    const { immunizationsMap } = groupSameImmunizations([immunization, immunization2]);
    expect(immunizationsMap.size).toBe(1);
  });

  it("correctly groups immunizations based on ndc codes", () => {
    immunization.vaccineCode = ndcCodeFlu;
    immunization2.vaccineCode = ndcCodeFlu;

    const { immunizationsMap } = groupSameImmunizations([immunization, immunization2]);
    expect(immunizationsMap.size).toBe(1);
  });

  it("correctly groups immunizations based on codes, despite the order", () => {
    immunization.vaccineCode = {
      ...cvxCodeFlu,
      coding: [...ndcCodeFlu.coding, ...cvxCodeFlu.coding],
    };
    immunization2.vaccineCode = {
      ...cvxCodeFlu,
      coding: [...cvxCodeFlu.coding, ...ndcCodeFlu.coding],
    };

    const { immunizationsMap } = groupSameImmunizations([immunization, immunization2]);
    expect(immunizationsMap.size).toBe(1);
  });

  it("correctly groups immunizations based on display", () => {
    const codeWithOnlyDisplay = {
      ...cvxCodeFlu,
      coding: [{ display: "Influenza, split virus, quadrivalent, PF" }],
    };

    immunization.vaccineCode = codeWithOnlyDisplay;
    immunization2.vaccineCode = codeWithOnlyDisplay;

    const { immunizationsMap } = groupSameImmunizations([immunization, immunization2]);
    expect(immunizationsMap.size).toBe(1);
  });

  it("does not group immunizations with different dates", () => {
    immunization.occurrenceDateTime = dateTime.start;
    immunization2.occurrenceDateTime = dateTime2.start;
    immunization.vaccineCode = cvxCodeFlu;
    immunization2.vaccineCode = cvxCodeFlu;

    const { immunizationsMap } = groupSameImmunizations([immunization, immunization2]);
    expect(immunizationsMap.size).toBe(2);
  });

  it("removes immunizations without codes", () => {
    const { immunizationsMap } = groupSameImmunizations([immunization]);
    expect(immunizationsMap.size).toBe(0);
  });

  // it("removes immunizations with unknown date", () => {
  //   immunization.occurrenceDateTime = dateTime.start;
  //   immunization2.occurrenceString = "unknown";
  //   immunization.vaccineCode = cvxCodeFlu;
  //   immunization2.vaccineCode = cvxCodeFlu;

  //   const { immunizationsMap } = groupSameImmunizations([immunization, immunization2]);
  //   expect(immunizationsMap.size).toBe(1);
  // });
});
