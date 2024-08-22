import { faker } from "@faker-js/faker";
import { Encounter } from "@medplum/fhirtypes";
import { makeEncounter } from "../../fhir-to-cda/cda-templates/components/__tests__/make-encounter";
import { groupSameEncounters } from "../resources/encounter";
import { dateTime, dateTime2 } from "./examples/condition-examples";

let encounterId: string;
let encounterId2: string;
let encounter: Encounter;
let encounter2: Encounter;

beforeEach(() => {
  encounterId = faker.string.uuid();
  encounterId2 = faker.string.uuid();
  encounter = makeEncounter({ id: encounterId });
  encounter2 = makeEncounter({ id: encounterId2 });
});

describe("groupSameEncounters", () => {
  it("correctly groups duplicate encounters based on date", () => {
    encounter.period = { start: dateTime.start };
    encounter2.period = { start: dateTime.start };

    const { encountersMap, refReplacementMap } = groupSameEncounters([encounter, encounter2]);
    expect(encountersMap.size).toBe(1);

    // Making sure ref to encounter2.id is present in the array of refs being replaced
    expect(refReplacementMap.entries().next().value).toEqual(
      expect.arrayContaining([
        expect.stringContaining(encounterId),
        expect.arrayContaining([expect.stringContaining(`Encounter/${encounterId2}`)]),
      ])
    );
  });

  it("does not group encounters with different dates", () => {
    encounter.period = { start: dateTime.start };
    encounter2.period = { start: dateTime2.start };

    const { encountersMap } = groupSameEncounters([encounter, encounter2]);
    expect(encountersMap.size).toBe(2);
  });

  it("keeps the more informative status", () => {
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
    const { encountersMap } = groupSameEncounters([encounter, encounter2]);
    expect(encountersMap.size).toBe(0);
  });
});
