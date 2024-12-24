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
import { dateTime, dateTime2 } from "./examples/condition-examples";

function initEncounter(practitionerId?: string, isIncludePractitioner = false) {
  const encounterId = faker.string.uuid();

  const encounter = isIncludePractitioner
    ? makeEncounter({ id: encounterId }, { pract: practitionerId ?? faker.string.uuid() })
    : makeEncounter({ id: encounterId });

  return { encounter, encounterId };
}

describe("groupSameEncounters", () => {
  it("correctly groups duplicate encounters based on date", () => {
    const practitionerId = faker.string.uuid();

    const { encounter, encounterId } = initEncounter(practitionerId, true);
    const { encounter: encounter2, encounterId: encounterId2 } = initEncounter(
      practitionerId,
      true
    );

    encounter.period = { start: dateTime.start };
    encounter2.period = { start: dateTime.start };

    const { encountersMap, refReplacementMap } = groupSameEncounters([encounter, encounter2]);
    expect(encountersMap.size).toBe(1);

    // Making sure ref to encounter2.id is present in the array of refs being replaced
    expect(refReplacementMap.entries().next().value).toEqual(
      expect.arrayContaining([
        expect.stringContaining(`Encounter/${encounterId}`),
        expect.stringContaining(`Encounter/${encounterId2}`),
      ])
    );
  });

  it("does not group encounters with different dates", () => {
    const encounter = makeEncounter();
    const encounter2 = makeEncounter();

    encounter.period = { start: dateTime.start };
    encounter2.period = { start: dateTime2.start };

    const { encountersMap } = groupSameEncounters([encounter, encounter2]);
    expect(encountersMap.size).toBe(2);
  });

  it("does not group encounters with different practitioners", () => {
    const practitionerId = faker.string.uuid();
    const { encounter } = initEncounter(practitionerId, true);
    const encounterId2 = faker.string.uuid();

    const encounter2 = makeEncounter({ id: encounterId2 }, { pract: faker.string.uuid() });

    encounter.period = { start: dateTime.start };
    encounter2.period = { start: dateTime.start };

    const { encountersMap } = groupSameEncounters([encounter, encounter2]);
    expect(encountersMap.size).toBe(2);
  });

  it("combines all fields as expected, with different fields", () => {
    const practitionerId = faker.string.uuid();

    const { encounter } = initEncounter(practitionerId, true);
    const { encounter: encounter2 } = initEncounter(practitionerId, true);

    encounter.period = { start: dateTime.start };
    encounter2.period = { start: dateTime.start };

    encounter.type = exampleType;
    encounter.hospitalization = exampleHospitalization;
    encounter.reasonCode = exampleReasonCode;
    encounter.diagnosis = exampleDiagnosis;

    const { encountersMap } = groupSameEncounters([encounter, encounter2]);
    expect(encountersMap.size).toBe(1);
    const masterEncounter = encountersMap.values().next().value as Encounter;
    expect(masterEncounter.type).toEqual(exampleType);
    expect(masterEncounter.hospitalization).toEqual(exampleHospitalization);
    expect(masterEncounter.reasonCode).toEqual(exampleReasonCode);
    expect(masterEncounter.diagnosis).toEqual(exampleDiagnosis);
  });

  it("combines all fields as expected, with overlapping fields", () => {
    const practitionerId = faker.string.uuid();

    const { encounter } = initEncounter(practitionerId, true);
    const { encounter: encounter2 } = initEncounter(practitionerId, true);

    encounter.period = { start: dateTime.start };
    encounter2.period = { start: dateTime.start };

    encounter.type = exampleType;
    encounter.hospitalization = exampleHospitalization;
    encounter.reasonCode = exampleReasonCode;
    encounter.diagnosis = exampleDiagnosis;

    encounter2.type = exampleType2;
    encounter2.hospitalization = exampleHospitalization2;
    encounter2.reasonCode = exampleReasonCode2;
    encounter2.diagnosis = exampleDiagnosis2;

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
    const practitionerId = faker.string.uuid();

    const { encounter } = initEncounter(practitionerId, true);
    const { encounter: encounter2 } = initEncounter(practitionerId, true);

    encounter.period = { start: dateTime.start };
    encounter2.period = { start: dateTime.start };

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
