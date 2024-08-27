import { faker } from "@faker-js/faker";
import { Coverage } from "@medplum/fhirtypes";
import { groupSameCoverages } from "../resources/coverage";
import { makeCoverage } from "../../fhir-to-cda/cda-templates/components/__tests__/make-coverage";
import { dateTime, dateTime2 } from "./examples/condition-examples";

let coverageId: string;
let coverageId2: string;
let coverage: Coverage;
let coverage2: Coverage;
let payorRef: string;

beforeEach(() => {
  payorRef = faker.string.uuid();
  coverageId = faker.string.uuid();
  coverageId2 = faker.string.uuid();
  coverage = makeCoverage({ id: coverageId }, payorRef);
  coverage2 = makeCoverage({ id: coverageId2 }, payorRef);
});

describe("groupSameCoverages", () => {
  it("correctly groups duplicate coverages based on the payor organization ref", () => {
    const { coveragesMap } = groupSameCoverages([coverage, coverage2]);
    expect(coveragesMap.size).toBe(1);
  });

  it("correctly groups duplicate coverages based on the payor org ref, status, and period", () => {
    coverage.status = "active";
    coverage2.status = "active";

    coverage.period = {
      start: dateTime.start,
      end: dateTime2.start,
    };
    coverage2.period = {
      start: dateTime.start,
      end: dateTime2.start,
    };

    const { coveragesMap } = groupSameCoverages([coverage, coverage2]);
    expect(coveragesMap.size).toBe(1);
  });

  it("does not group coverages with different periods", () => {
    coverage.status = "active";
    coverage2.status = "active";

    coverage.period = {
      start: dateTime.start,
      end: dateTime2.start,
    };
    coverage2.period = {
      start: dateTime.start,
      end: "2013-01-01T17:00:00.000Z",
    };

    const { coveragesMap } = groupSameCoverages([coverage, coverage2]);
    expect(coveragesMap.size).toBe(2);
  });
});
