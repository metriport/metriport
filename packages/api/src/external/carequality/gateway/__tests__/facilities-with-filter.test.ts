import { facilitiesWithEpicFilter, EPIC_ORG_NAME } from "../index";
import { makeCQDirectoryEntry } from "../../__tests__/cq-directory";

describe("facilitiesWithEpicFilter", () => {
  it("returns all facilities when epic is true", async () => {
    const isEpicEnabled = true;

    const epicFacilityEntry = makeCQDirectoryEntry({
      managingOrganization: EPIC_ORG_NAME,
    });

    const nonEpicFacilityEntry = makeCQDirectoryEntry({
      managingOrganization: "TEST",
    });

    const filteredOrgs = facilitiesWithEpicFilter(
      [epicFacilityEntry, nonEpicFacilityEntry],
      isEpicEnabled
    );

    expect(filteredOrgs).toHaveLength(2);
    expect(filteredOrgs).toEqual([epicFacilityEntry, nonEpicFacilityEntry]);
  });

  it("filters out all facilities when epic is enabled and facilities are all epic", async () => {
    const isEpicEnabled = false;

    const epicFacilityEntry = makeCQDirectoryEntry({
      managingOrganization: EPIC_ORG_NAME,
    });

    const epicFacilityEntryTwo = makeCQDirectoryEntry({
      managingOrganization: EPIC_ORG_NAME,
    });

    const filteredOrgs = facilitiesWithEpicFilter(
      [epicFacilityEntry, epicFacilityEntryTwo],
      isEpicEnabled
    );

    expect(filteredOrgs).toHaveLength(0);
    expect(filteredOrgs).toEqual([]);
  });

  it("filters out some facilities when epic is enabled and some facilities are under epic", async () => {
    const isEpicEnabled = false;

    const epicFacilityEntry = makeCQDirectoryEntry({
      managingOrganization: EPIC_ORG_NAME,
    });

    const nonEpicFacilityEntry = makeCQDirectoryEntry({
      managingOrganization: "TEST",
    });

    const filteredOrgs = facilitiesWithEpicFilter(
      [epicFacilityEntry, nonEpicFacilityEntry],
      isEpicEnabled
    );

    expect(filteredOrgs).toHaveLength(1);
    expect(filteredOrgs).toEqual([nonEpicFacilityEntry]);
  });
});
