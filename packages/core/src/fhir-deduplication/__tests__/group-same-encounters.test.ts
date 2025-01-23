import { faker } from "@faker-js/faker";
import { Encounter } from "@medplum/fhirtypes";
import {
  exampleDiagnosis,
  exampleDiagnosis2,
  exampleHospitalization,
  exampleHospitalization2,
  exampleReasonCode,
  exampleReasonCode2,
  exampleType,
  exampleType2,
  makeEncounter,
} from "../../fhir-to-cda/cda-templates/components/__tests__/make-encounter";
import { groupSameEncounters } from "../resources/encounter";
import { makePeriod } from "./examples/condition-examples";

function initEncounter(practitionerId?: string, params?: Partial<Encounter>) {
  const encounterId = faker.string.uuid();

  const encounter = practitionerId
    ? makeEncounter({ id: encounterId, ...params }, { pract: practitionerId })
    : makeEncounter({ id: encounterId });

  return encounter;
}

describe("groupSameEncounters", () => {
  it("correctly groups duplicate encounters based on date", () => {
    const period = makePeriod();
    const practitionerId = faker.string.uuid();

    const encounter = initEncounter(practitionerId, { period: { start: period.start } });
    const encounter2 = initEncounter(practitionerId, { period: { start: period.start } });

    const { encountersMap, refReplacementMap } = groupSameEncounters([encounter, encounter2]);
    expect(encountersMap.size).toBe(1);

    // Making sure ref to encounter2.id is present in the array of refs being replaced
    expect(refReplacementMap.entries().next().value).toEqual(
      expect.arrayContaining([
        expect.stringContaining(`Encounter/${encounter.id}`),
        expect.stringContaining(`Encounter/${encounter.id}`),
      ])
    );
  });

  it("does not group encounters with different dates", () => {
    const period = makePeriod();
    const encounter = makeEncounter();
    const encounter2 = makeEncounter();

    encounter.period = { start: period.start };
    encounter2.period = { start: period.end };

    const { encountersMap } = groupSameEncounters([encounter, encounter2]);
    expect(encountersMap.size).toBe(2);
  });

  it("does not group encounters with different practitioners", () => {
    const period = makePeriod();
    const params = {
      period: { start: period.start },
    };

    const encounter = initEncounter(faker.string.uuid(), params);
    const encounter2 = initEncounter(faker.string.uuid(), params);

    const { encountersMap } = groupSameEncounters([encounter, encounter2]);
    expect(encountersMap.size).toBe(2);
  });

  it("combines all fields as expected, with different fields", () => {
    const period = makePeriod();
    const practitionerId = faker.string.uuid();

    const params = {
      period: { start: period.start },
    };
    const params2 = {
      ...params,
      type: exampleType,
      hospitalization: exampleHospitalization,
      reasonCode: exampleReasonCode,
      diagnosis: exampleDiagnosis,
    };

    const encounter = initEncounter(practitionerId, params);
    const encounter2 = initEncounter(practitionerId, params2);

    const { encountersMap } = groupSameEncounters([encounter, encounter2]);
    expect(encountersMap.size).toBe(1);
    const masterEncounter = encountersMap.values().next().value as Encounter;
    expect(masterEncounter.type).toEqual(exampleType);
    expect(masterEncounter.hospitalization).toEqual(exampleHospitalization);
    expect(masterEncounter.reasonCode).toEqual(exampleReasonCode);
    expect(masterEncounter.diagnosis).toEqual(exampleDiagnosis);
  });

  it("combines all fields as expected, with overlapping fields", () => {
    const period = makePeriod();
    const practitionerId = faker.string.uuid();
    const params = {
      period: { start: period.start },
      type: exampleType,
      hospitalization: exampleHospitalization,
      reasonCode: exampleReasonCode,
      diagnosis: exampleDiagnosis,
    };
    const params2 = {
      period: { start: period.start },
      type: exampleType2,
      hospitalization: exampleHospitalization2,
      reasonCode: exampleReasonCode2,
      diagnosis: exampleDiagnosis2,
    };

    const encounter = initEncounter(practitionerId, params);
    const encounter2 = initEncounter(practitionerId, params2);

    const { encountersMap } = groupSameEncounters([encounter, encounter2]);
    expect(encountersMap.size).toBe(1);
    const masterEncounter = encountersMap.values().next().value as Encounter;
    expect(masterEncounter.type).toEqual(expect.arrayContaining([...exampleType, ...exampleType2]));
    expect(masterEncounter.hospitalization).toEqual(
      expect.objectContaining({
        dischargeDisposition: expect.objectContaining({
          coding: expect.arrayContaining([
            ...exampleHospitalization.dischargeDisposition.coding,
            ...exampleHospitalization2.dischargeDisposition.coding,
          ]),
        }),
      })
    );
    expect(masterEncounter.reasonCode).toEqual(
      expect.arrayContaining([...exampleReasonCode, ...exampleReasonCode2])
    );
    expect(masterEncounter.diagnosis).toEqual(
      expect.arrayContaining([...exampleDiagnosis, ...exampleDiagnosis2])
    );
  });

  it("keeps the more informative status", () => {
    const period = makePeriod();
    const practitionerId = faker.string.uuid();

    const params = {
      period: { start: period.start },
    };
    const encounter = initEncounter(practitionerId, params);
    const encounter2 = initEncounter(practitionerId, params);

    encounter.status = "finished";
    encounter2.status = "arrived";

    let result = groupSameEncounters([encounter, encounter2]);
    expect(result.encountersMap.size).toBe(1);
    let masterEncounter = result.encountersMap.values().next().value;
    expect(masterEncounter.status).toBe("finished");

    encounter.status = "in-progress";
    encounter2.status = "planned";

    result = groupSameEncounters([encounter, encounter2]);
    masterEncounter = result.encountersMap.values().next().value;
    expect(masterEncounter.status).toBe("in-progress");

    encounter.status = "triaged";
    encounter2.status = "unknown";

    result = groupSameEncounters([encounter, encounter2]);
    masterEncounter = result.encountersMap.values().next().value;
    expect(masterEncounter.status).toBe("triaged");
  });

  it("does not group encounters when dates are missing", () => {
    const encounter = makeEncounter();
    const encounter2 = makeEncounter();

    const { encountersMap } = groupSameEncounters([encounter, encounter2]);
    expect(encountersMap.size).toBe(0);
  });
});
