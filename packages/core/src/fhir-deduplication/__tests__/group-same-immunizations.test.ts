import { makeImmunization } from "../../fhir-to-cda/cda-templates/components/__tests__/make-immunization";
import { groupSameImmunizations } from "../resources/immunization";
import { makePeriod } from "./examples/condition-examples";
import { cvxCodeFlu, ndcCodeFlu } from "./examples/immunization-examples";

describe("groupSameImmunizations", () => {
  it("correctly groups immunizations based on cvx codes without dates", () => {
    const immunization = makeImmunization({ vaccineCode: cvxCodeFlu });
    const immunization2 = makeImmunization({ vaccineCode: cvxCodeFlu });

    const { immunizationsMap } = groupSameImmunizations([immunization, immunization2]);
    expect(immunizationsMap.size).toBe(1);
  });

  it("correctly groups immunizations based on cvx codes and dates", () => {
    const period = makePeriod();
    const immunization = makeImmunization({
      occurrenceDateTime: period.start,
      vaccineCode: cvxCodeFlu,
    });
    const immunization2 = makeImmunization({
      occurrenceDateTime: period.start,
      vaccineCode: cvxCodeFlu,
    });

    const { immunizationsMap } = groupSameImmunizations([immunization, immunization2]);
    expect(immunizationsMap.size).toBe(1);
  });

  it("correctly groups immunizations with the same code, where one is missing the date", () => {
    const period = makePeriod();
    const immunization = makeImmunization({
      vaccineCode: cvxCodeFlu,
      occurrenceDateTime: period.start,
    });
    const immunization2 = makeImmunization({ vaccineCode: cvxCodeFlu });

    const { immunizationsMap } = groupSameImmunizations([immunization, immunization2]);
    expect(immunizationsMap.size).toBe(1);
  });

  it("correctly groups immunizations based on ndc codes", () => {
    const immunization = makeImmunization({ vaccineCode: ndcCodeFlu });
    const immunization2 = makeImmunization({ vaccineCode: ndcCodeFlu });

    const { immunizationsMap } = groupSameImmunizations([immunization, immunization2]);
    expect(immunizationsMap.size).toBe(1);
  });

  it("correctly groups immunizations based on codes, despite the order", () => {
    const immunization = makeImmunization({
      vaccineCode: {
        ...cvxCodeFlu,
        coding: [...ndcCodeFlu.coding, ...cvxCodeFlu.coding],
      },
    });
    const immunization2 = makeImmunization({
      vaccineCode: {
        ...cvxCodeFlu,
        coding: [...cvxCodeFlu.coding, ...ndcCodeFlu.coding],
      },
    });

    const { immunizationsMap } = groupSameImmunizations([immunization, immunization2]);
    expect(immunizationsMap.size).toBe(1);
  });

  it("correctly groups immunizations based on display", () => {
    const codeWithOnlyDisplay = {
      ...cvxCodeFlu,
      coding: [{ display: "Influenza, split virus, quadrivalent, PF" }],
    };
    const immunization = makeImmunization({ vaccineCode: codeWithOnlyDisplay });
    const immunization2 = makeImmunization({ vaccineCode: codeWithOnlyDisplay });

    const { immunizationsMap } = groupSameImmunizations([immunization, immunization2]);
    expect(immunizationsMap.size).toBe(1);
  });

  it("does not group immunizations with different dates", () => {
    const period = makePeriod();
    const immunization = makeImmunization({
      vaccineCode: cvxCodeFlu,
      occurrenceDateTime: period.start,
    });
    const immunization2 = makeImmunization({
      vaccineCode: cvxCodeFlu,
      occurrenceDateTime: period.end,
    });

    const { immunizationsMap } = groupSameImmunizations([immunization, immunization2]);
    expect(immunizationsMap.size).toBe(2);
  });

  it("removes immunizations without codes", () => {
    const immunization = makeImmunization();

    const { immunizationsMap } = groupSameImmunizations([immunization]);
    expect(immunizationsMap.size).toBe(0);
  });
});
