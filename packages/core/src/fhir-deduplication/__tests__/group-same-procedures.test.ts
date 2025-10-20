import { Procedure } from "@medplum/fhirtypes";
import { makeProcedure } from "../../fhir-to-cda/cda-templates/components/__tests__/make-procedure";
import { groupSameProcedures } from "../resources/procedure";
import { makePeriod } from "./examples/condition-examples";
import { cptCodeAb, loincCodeAb, snomedCodeAb } from "./examples/procedure-examples";

describe("groupSameProcedures", () => {
  it("correctly groups procedures based on cpt codes without dates", () => {
    const params = {
      code: cptCodeAb,
    };
    const procedure = makeProcedure(params);
    const procedure2 = makeProcedure(params);

    const { proceduresMap } = groupSameProcedures([procedure, procedure2]);
    expect(proceduresMap.size).toBe(1);
  });

  it("correctly groups procedures based on loinc codes without dates", () => {
    const params = {
      code: loincCodeAb,
    };
    const procedure = makeProcedure(params);
    const procedure2 = makeProcedure(params);

    const { proceduresMap } = groupSameProcedures([procedure, procedure2]);
    expect(proceduresMap.size).toBe(1);
  });

  it("correctly groups procedures based on snomed codes without dates", () => {
    const params = {
      code: snomedCodeAb,
    };
    const procedure = makeProcedure(params);
    const procedure2 = makeProcedure(params);

    const { proceduresMap } = groupSameProcedures([procedure, procedure2]);
    expect(proceduresMap.size).toBe(1);
  });

  it("correctly groups procedures based on cpt codes and dates", () => {
    const period = makePeriod();
    const params = {
      code: cptCodeAb,
      performedDateTime: period.start,
    };
    const procedure = makeProcedure(params);
    const procedure2 = makeProcedure(params);

    const { proceduresMap } = groupSameProcedures([procedure, procedure2]);
    expect(proceduresMap.size).toBe(1);
  });

  it("correctly groups procedures based on cpt codes, where one has the date and the other does not", () => {
    const period = makePeriod();
    const params = {
      code: cptCodeAb,
    };
    const procedure = makeProcedure({ ...params, performedDateTime: period.start });
    const procedure2 = makeProcedure(params);

    const { proceduresMap } = groupSameProcedures([procedure, procedure2]);
    expect(proceduresMap.size).toBe(1);
  });

  it("does not group procedures with different dates", () => {
    const period = makePeriod();
    const params = {
      code: cptCodeAb,
    };
    const procedure = makeProcedure({ ...params, performedDateTime: period.start });
    const procedure2 = makeProcedure({ ...params, performedDateTime: period.end });

    const { proceduresMap } = groupSameProcedures([procedure, procedure2]);
    expect(proceduresMap.size).toBe(2);
  });

  it("does not group procedures with different codes", () => {
    const period = makePeriod();
    const params = {
      performedDateTime: period.start,
    };
    const procedure = makeProcedure({ ...params, code: cptCodeAb });
    const procedure2 = makeProcedure({ ...params, code: loincCodeAb });

    const { proceduresMap } = groupSameProcedures([procedure, procedure2]);
    expect(proceduresMap.size).toBe(2);
  });

  it("preserves cpt and loinc codes, but removes epic codes", () => {
    const period = makePeriod();
    const params = {
      performedDateTime: period.start,
    };
    const procedure = makeProcedure({
      ...params,
      code: {
        coding: [
          ...cptCodeAb.coding,
          ...loincCodeAb.coding,
          {
            system: "urn:oid:1.2.840.114350.1.13.551.2.7.2.696580",
            code: "110195",
          },
        ],
      },
    });
    const procedure2 = makeProcedure({
      ...params,
      code: {
        coding: [...cptCodeAb.coding],
      },
    });

    const { proceduresMap } = groupSameProcedures([procedure, procedure2]);
    expect(proceduresMap.size).toBe(1);
    const masterProcedure = proceduresMap.values().next().value as Procedure;
    const coding = masterProcedure.code?.coding;
    expect(coding?.length).toEqual(2);
    expect(coding).toEqual(expect.arrayContaining([...cptCodeAb.coding, ...loincCodeAb.coding]));
  });

  it("doesnt remove code and preserves original coding when there is only one unknown code", () => {
    const period = makePeriod();
    const originalCoding = [
      {
        system: "some system",
        code: "some code",
        display: "some display",
      },
    ];
    const params = {
      performedDateTime: period.start,
      code: { coding: originalCoding },
    };

    const procedure = makeProcedure(params);
    const procedure2 = makeProcedure(params);

    const { proceduresMap } = groupSameProcedures([procedure, procedure2]);
    expect(proceduresMap.size).toBe(1);

    const masterProcedure = proceduresMap.values().next().value as Procedure;
    expect(masterProcedure.code?.coding).toEqual(originalCoding);
  });
});
