import { faker } from "@faker-js/faker";
import { Immunization } from "@medplum/fhirtypes";
import { makeImmunization } from "../../fhir-to-cda/cda-templates/components/__tests__/make-immunization";
import { groupSameImmunizations } from "../resources/immunization";
import { cvxCodeFlu } from "./examples/immunization-examples";
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
  it("correctly groups duplicate immunizations based on cvx codes and dates", () => {
    immunization.occurrenceDateTime = dateTime.start;
    immunization2.occurrenceDateTime = dateTime.start;
    immunization.vaccineCode = cvxCodeFlu;
    immunization2.vaccineCode = cvxCodeFlu;

    const { immunizationsCvxMap } = groupSameImmunizations([immunization, immunization2]);
    expect(immunizationsCvxMap.size).toBe(1);
  });

  it("does not group immunizations with different dates", () => {
    immunization.occurrenceDateTime = dateTime.start;
    immunization2.occurrenceDateTime = dateTime2.start;
    immunization.vaccineCode = cvxCodeFlu;
    immunization2.vaccineCode = cvxCodeFlu;

    const { immunizationsCvxMap } = groupSameImmunizations([immunization, immunization2]);
    expect(immunizationsCvxMap.size).toBe(2);
  });

  it("removes immunizations with undefined dates", () => {
    immunization.vaccineCode = cvxCodeFlu;
    immunization2.vaccineCode = cvxCodeFlu;

    const { immunizationsCvxMap } = groupSameImmunizations([immunization, immunization2]);
    expect(immunizationsCvxMap.size).toBe(0);
  });

  it("removes immunizations with unknown date", () => {
    immunization.occurrenceDateTime = dateTime.start;
    immunization2.occurrenceString = "unknown";
    immunization.vaccineCode = cvxCodeFlu;
    immunization2.vaccineCode = cvxCodeFlu;

    const { immunizationsCvxMap } = groupSameImmunizations([immunization, immunization2]);
    expect(immunizationsCvxMap.size).toBe(1);
  });
});
