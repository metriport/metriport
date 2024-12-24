import { makeImmunization } from "../../fhir-to-cda/cda-templates/components/__tests__/make-immunization";
import { groupSameImmunizations } from "../resources/immunization";
import { dateTime, dateTime2 } from "./examples/condition-examples";
import { cvxCodeFlu, ndcCodeFlu } from "./examples/immunization-examples";

describe("groupSameImmunizations", () => {
  it("correctly groups immunizations based on cvx codes without dates", () => {
    const immunization = makeImmunization();
    const immunization2 = makeImmunization();

    immunization.vaccineCode = cvxCodeFlu;
    immunization2.vaccineCode = cvxCodeFlu;

    const { immunizationsMap } = groupSameImmunizations([immunization, immunization2]);
    expect(immunizationsMap.size).toBe(1);
  });

  it("correctly groups immunizations based on cvx codes and dates", () => {
    const immunization = makeImmunization();
    const immunization2 = makeImmunization();

    immunization.occurrenceDateTime = dateTime.start;
    immunization2.occurrenceDateTime = dateTime.start;
    immunization.vaccineCode = cvxCodeFlu;
    immunization2.vaccineCode = cvxCodeFlu;

    const { immunizationsMap } = groupSameImmunizations([immunization, immunization2]);
    expect(immunizationsMap.size).toBe(1);
  });

  it("correctly groups immunizations with the same code, where one is missing the date", () => {
    const immunization = makeImmunization();
    const immunization2 = makeImmunization();

    immunization.occurrenceDateTime = dateTime.start;
    immunization.vaccineCode = cvxCodeFlu;
    immunization2.vaccineCode = cvxCodeFlu;

    const { immunizationsMap } = groupSameImmunizations([immunization, immunization2]);
    expect(immunizationsMap.size).toBe(1);
  });

  it("correctly groups immunizations based on ndc codes", () => {
    const immunization = makeImmunization();
    const immunization2 = makeImmunization();

    immunization.vaccineCode = ndcCodeFlu;
    immunization2.vaccineCode = ndcCodeFlu;

    const { immunizationsMap } = groupSameImmunizations([immunization, immunization2]);
    expect(immunizationsMap.size).toBe(1);
  });

  it("correctly groups immunizations based on codes, despite the order", () => {
    const immunization = makeImmunization();
    const immunization2 = makeImmunization();

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
    const immunization = makeImmunization();
    const immunization2 = makeImmunization();

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
    const immunization = makeImmunization();
    const immunization2 = makeImmunization();

    immunization.occurrenceDateTime = dateTime.start;
    immunization2.occurrenceDateTime = dateTime2.start;
    immunization.vaccineCode = cvxCodeFlu;
    immunization2.vaccineCode = cvxCodeFlu;

    const { immunizationsMap } = groupSameImmunizations([immunization, immunization2]);
    expect(immunizationsMap.size).toBe(2);
  });

  it("removes immunizations without codes", () => {
    const immunization = makeImmunization();

    const { immunizationsMap } = groupSameImmunizations([immunization]);
    expect(immunizationsMap.size).toBe(0);
  });
});
