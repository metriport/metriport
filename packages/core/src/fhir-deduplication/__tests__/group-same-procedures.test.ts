import { faker } from "@faker-js/faker";
import { Procedure } from "@medplum/fhirtypes";
import { makeProcedure } from "../../fhir-to-cda/cda-templates/components/__tests__/make-procedure";
import { groupSameProcedures } from "../resources/procedure";
import { dateTime, dateTime2 } from "./examples/condition-examples";
import { cptCodeAb, loincCodeAb, snomedCodeAb } from "./examples/procedure-examples";

let procedureId: string;
let procedureId2: string;
let procedure: Procedure;
let procedure2: Procedure;

beforeEach(() => {
  procedureId = faker.string.uuid();
  procedureId2 = faker.string.uuid();
  procedure = makeProcedure({ id: procedureId });
  procedure2 = makeProcedure({ id: procedureId2 });
});

describe("groupSameProcedures", () => {
  it("correctly groups procedures based on cpt codes without dates", () => {
    procedure.code = cptCodeAb;
    procedure2.code = cptCodeAb;

    const { proceduresMap } = groupSameProcedures([procedure, procedure2]);
    expect(proceduresMap.size).toBe(1);
  });

  it("correctly groups procedures based on loinc codes without dates", () => {
    procedure.code = loincCodeAb;
    procedure2.code = loincCodeAb;

    const { proceduresMap } = groupSameProcedures([procedure, procedure2]);
    expect(proceduresMap.size).toBe(1);
  });

  it("correctly groups procedures based on snomed codes without dates", () => {
    procedure.code = snomedCodeAb;
    procedure2.code = snomedCodeAb;

    const { proceduresMap } = groupSameProcedures([procedure, procedure2]);
    expect(proceduresMap.size).toBe(1);
  });

  it("correctly groups procedures based on cpt codes and dates", () => {
    procedure.performedDateTime = dateTime.start;
    procedure2.performedDateTime = dateTime.start;
    procedure.code = cptCodeAb;
    procedure2.code = cptCodeAb;

    const { proceduresMap } = groupSameProcedures([procedure, procedure2]);
    expect(proceduresMap.size).toBe(1);
  });

  it("correctly groups procedures based on cpt codes, where one has the date and the other does not", () => {
    procedure.performedDateTime = dateTime.start;
    procedure.code = cptCodeAb;
    procedure2.code = cptCodeAb;

    const { proceduresMap } = groupSameProcedures([procedure, procedure2]);
    expect(proceduresMap.size).toBe(1);
  });

  it("does not group procedures with different dates", () => {
    procedure.performedDateTime = dateTime.start;
    procedure2.performedDateTime = dateTime2.start;
    procedure.code = cptCodeAb;
    procedure2.code = cptCodeAb;

    const { proceduresMap } = groupSameProcedures([procedure, procedure2]);
    expect(proceduresMap.size).toBe(2);
  });

  it("does not group procedures with different codes", () => {
    procedure.performedDateTime = dateTime.start;
    procedure2.performedDateTime = dateTime.start;
    procedure.code = cptCodeAb;
    procedure2.code = loincCodeAb;

    const { proceduresMap } = groupSameProcedures([procedure, procedure2]);
    expect(proceduresMap.size).toBe(2);
  });

  it("preserves cpt and loinc codes, but removes epic codes", () => {
    procedure.performedDateTime = dateTime.start;
    procedure2.performedDateTime = dateTime.start;
    procedure.code = {
      coding: [
        ...cptCodeAb.coding,
        ...loincCodeAb.coding,
        {
          system: "urn:oid:1.2.840.114350.1.13.551.2.7.2.696580",
          code: "110195",
        },
      ],
    };
    procedure2.code = {
      coding: [...cptCodeAb.coding],
    };

    const { proceduresMap } = groupSameProcedures([procedure, procedure2]);
    expect(proceduresMap.size).toBe(1);
    const masterProcedure = proceduresMap.values().next().value as Procedure;
    const coding = masterProcedure.code?.coding;
    expect(coding?.length).toEqual(2);
    expect(coding).toEqual(expect.arrayContaining([...cptCodeAb.coding, ...loincCodeAb.coding]));
  });

  it("doesnt remove code and preserves original coding when there is only one unknown code", () => {
    procedure.performedDateTime = dateTime.start;
    procedure2.performedDateTime = dateTime.start;
    const originalCoding = [
      {
        system: "some system",
        code: "some code",
        display: "some display",
      },
    ];
    procedure.code = { coding: originalCoding };
    procedure2.code = { coding: originalCoding };

    const { proceduresMap } = groupSameProcedures([procedure, procedure2]);
    expect(proceduresMap.size).toBe(1);

    const masterProcedure = proceduresMap.values().next().value as Procedure;
    expect(masterProcedure.code?.coding).toEqual(originalCoding);
  });
});
