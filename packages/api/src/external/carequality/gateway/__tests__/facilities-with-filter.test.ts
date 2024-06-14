import { facilitiesWithEpicFilter, EPIC_ID } from "../index";
import { makeCQDirectoryEntry } from "../../__tests__/cq-directory";

describe("facilitiesWithEpicFilter", () => {
  it("returns all facilities when epic is true", async () => {
    const isEpicEnabled = true;

    const epicFacilityEntry = makeCQDirectoryEntry({
      managingOrganizationId: EPIC_ID,
    });

    const epicOrgEntry = makeCQDirectoryEntry({
      id: EPIC_ID,
    });

    const filteredOrgs = facilitiesWithEpicFilter([epicFacilityEntry, epicOrgEntry], isEpicEnabled);

    expect(filteredOrgs).toHaveLength(2);
    expect(filteredOrgs).toEqual([epicFacilityEntry, epicOrgEntry]);
  });

  it("filters out all facilities when epic is enabled and facilities are all epic", async () => {
    const isEpicEnabled = false;

    const epicFacilityEntry = makeCQDirectoryEntry({
      managingOrganizationId: EPIC_ID,
    });

    const epicOrgEntry = makeCQDirectoryEntry({
      id: EPIC_ID,
    });

    const filteredOrgs = facilitiesWithEpicFilter([epicFacilityEntry, epicOrgEntry], isEpicEnabled);

    expect(filteredOrgs).toHaveLength(0);
    expect(filteredOrgs).toEqual([]);
  });

  it("filters out some facilities when epic is enabled and some facilities are under epic", async () => {
    const isEpicEnabled = false;

    const epicFacilityEntry = makeCQDirectoryEntry({
      managingOrganizationId: EPIC_ID,
    });

    const nonEpicFacilityEntry = makeCQDirectoryEntry({
      managingOrganizationId: "1.2.3.4.5",
    });

    const epicOrgEntry = makeCQDirectoryEntry({
      id: EPIC_ID,
    });

    const filteredOrgs = facilitiesWithEpicFilter(
      [epicFacilityEntry, nonEpicFacilityEntry, epicOrgEntry],
      isEpicEnabled
    );

    expect(filteredOrgs).toHaveLength(1);
    expect(filteredOrgs).toEqual([nonEpicFacilityEntry]);
  });

  it("filters out all facilities when epic is enabled and some facilities are under epic nested", async () => {
    const isEpicEnabled = false;

    const epicOrgEntry = makeCQDirectoryEntry({
      id: EPIC_ID,
    });

    const epicFacilityEntry = makeCQDirectoryEntry({
      id: "1.2.3.4.5",
      managingOrganizationId: EPIC_ID,
    });

    const nestedEpicFacilityEntry = makeCQDirectoryEntry({
      managingOrganizationId: "1.2.3.4.5",
    });

    const filteredOrgs = facilitiesWithEpicFilter(
      [epicFacilityEntry, nestedEpicFacilityEntry, epicOrgEntry],
      isEpicEnabled
    );

    expect(filteredOrgs).toHaveLength(0);
    expect(filteredOrgs).toEqual([]);
  });
});
