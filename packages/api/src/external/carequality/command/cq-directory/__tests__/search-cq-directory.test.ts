import { faker } from "@faker-js/faker";
import convert from "convert-units";
import { makeAddressWithCoordinates } from "../../../../../domain/medical/__tests__/location-address";
import { makePatient } from "../../../../../domain/medical/__tests__/patient";
import { CQDirectoryEntry } from "../../../cq-directory";
import { makeCQDirectoryEntry } from "../../../__tests__/cq-directory";
import {
  searchCQDirectoriesAroundPatientAddresses,
  searchCQDirectoriesByRadius,
} from "../search-cq-directory";

describe("searchCQDirectoriesAroundPatientAddresses", () => {
  let searchCQDirectoriesByRadius_mock: jest.Func;
  beforeAll(() => {
    jest.restoreAllMocks();
  });
  beforeEach(() => {
    searchCQDirectoriesByRadius_mock = jest.fn(
      async () => []
    ) as typeof searchCQDirectoriesByRadius;
  });
  afterEach(() => {
    jest.clearAllMocks();
  });
  afterAll(() => {
    jest.restoreAllMocks();
  });

  it("returns empty array if no coordinates", async () => {
    const patient = makePatient();
    const expectedResult: CQDirectoryEntry[] = [makeCQDirectoryEntry()];
    searchCQDirectoriesByRadius_mock = jest.fn(() => expectedResult);

    const result = await searchCQDirectoriesAroundPatientAddresses({ patient });
    expect(result).toBeTruthy();
    expect(result.length).toEqual(0);
    expect(searchCQDirectoriesByRadius_mock).not.toHaveBeenCalled();
  });

  it("returns search result when there are coordinates", async () => {
    const address = makeAddressWithCoordinates();
    const patient = makePatient({ data: { address: [address] } });
    const expectedResult: CQDirectoryEntry[] = [makeCQDirectoryEntry(), makeCQDirectoryEntry()];
    searchCQDirectoriesByRadius_mock = jest.fn(() => expectedResult);

    const result = await searchCQDirectoriesAroundPatientAddresses({
      patient,
      _searchCQDirectoriesByRadius: searchCQDirectoriesByRadius_mock,
    });
    expect(result).toBeTruthy();
    expect(result.length).toEqual(expectedResult.length);
    expect(searchCQDirectoriesByRadius_mock).toHaveBeenCalled();
  });

  it("passes correct params to searchCQDirectoriesByRadius", async () => {
    const address1 = makeAddressWithCoordinates();
    const address2 = makeAddressWithCoordinates();
    const patient = makePatient({ data: { address: [address1, address2] } });
    const radiusInMiles = faker.number.int({ min: 5, max: 100 });
    const radiusInMeters = convert(radiusInMiles).from("mi").to("m");
    const mustHaveXcpdLink = faker.datatype.boolean();
    searchCQDirectoriesByRadius_mock = jest.fn(() => []);

    await searchCQDirectoriesAroundPatientAddresses({
      patient,
      radiusInMiles,
      mustHaveXcpdLink,
      _searchCQDirectoriesByRadius: searchCQDirectoriesByRadius_mock,
    });
    expect(searchCQDirectoriesByRadius_mock).toHaveBeenCalledWith({
      coordinates: expect.arrayContaining([address1.coordinates, address2.coordinates]),
      radiusInMeters,
      mustHaveXcpdLink,
    });
  });
});
