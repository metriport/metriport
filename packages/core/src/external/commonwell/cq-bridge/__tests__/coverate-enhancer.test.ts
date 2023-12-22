/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { fakerEN_US as faker } from "@faker-js/faker";
import { USState } from "../../../../domain/geographic-locations";
import { PatientLoaderMetriportAPI } from "../../../../domain/patient/patient-loader-metriport-api";
import { CoverageEnhancer, defaultMaxOrgsToProcess } from "../coverage-enhancer";
import { CQOrgHydrated, isLowPrio, isMediumPrio, OrgPrio } from "../get-orgs";
import { makeSimpleOrg } from "./cq-orgs";

class CoverageEnhancerLocal extends CoverageEnhancer {
  constructor(params: ConstructorParameters<typeof CoverageEnhancer>[0]) {
    super(params);
  }
  public enhanceCoverage(): Promise<string> {
    throw new Error("Method not implemented.");
  }
  override async getOrgsForPatients(cxId: string, patientIds: string[]): Promise<CQOrgHydrated[]> {
    return super.getOrgsForPatients(cxId, patientIds);
  }
  override getOrgsBy(
    prio: OrgPrio,
    orgsAlreadyIncluded: CQOrgHydrated[],
    states?: string[],
    gateway?: string
  ) {
    return super.getOrgsBy(prio, orgsAlreadyIncluded, states, gateway);
  }
}
const patientLoader = new PatientLoaderMetriportAPI("");

describe("getOrgsBy", () => {
  const state = USState.IL;
  const gateway = faker.company.name();
  const orgsToUse: Record<OrgPrio, CQOrgHydrated[]> = {
    high: [],
    medium: [
      makeSimpleOrg({ states: [state], gateway }),
      makeSimpleOrg({ gateway }),
      makeSimpleOrg({ states: [state] }),
      makeSimpleOrg(),
    ],
    low: [],
  };
  const coverageEnhancer = new CoverageEnhancerLocal({
    patientLoader,
    orgs: orgsToUse,
  });

  it("gets all orgs", async () => {
    const result = coverageEnhancer.getOrgsBy("medium", [])();
    expect(result).toBeTruthy();
    expect(result.length).toEqual(4);
    expect(result).toEqual(expect.arrayContaining(orgsToUse.medium));
  });

  it("gets by gateway", async () => {
    const result = coverageEnhancer.getOrgsBy("medium", [], undefined, gateway)();
    expect(result).toBeTruthy();
    expect(result.length).toEqual(2);
    expect(result).toEqual(expect.arrayContaining([orgsToUse.medium[0], orgsToUse.medium[1]]));
  });

  it("gets by state", async () => {
    const result = coverageEnhancer.getOrgsBy("medium", [], [state])();
    expect(result).toBeTruthy();
    expect(result.length).toEqual(2);
    expect(result).toEqual(expect.arrayContaining([orgsToUse.medium[0], orgsToUse.medium[2]]));
  });

  it("gets both by gateway and state", async () => {
    const result = coverageEnhancer.getOrgsBy("medium", [], [state], gateway)();
    expect(result).toBeTruthy();
    expect(result.length).toEqual(1);
    expect(result).toEqual(expect.arrayContaining([orgsToUse.medium[0]]));
  });

  it("excludes already included orgs", async () => {
    const result = coverageEnhancer.getOrgsBy("medium", [orgsToUse.medium[1]!])();
    expect(result).toBeTruthy();
    expect(result.length).toEqual(3);
    expect(result).toEqual(
      expect.arrayContaining([orgsToUse.medium[0], orgsToUse.medium[2], orgsToUse.medium[3]])
    );
  });
});

describe("getOrgsForPatients", () => {
  let getStatesFromPatientIds_mock: jest.SpyInstance;
  beforeEach(() => {
    jest.restoreAllMocks();
    getStatesFromPatientIds_mock = jest.spyOn(
      PatientLoaderMetriportAPI.prototype,
      "getStatesFromPatientIds"
    );
  });

  it("gets all medium orgs", async () => {
    const cxId = faker.string.uuid();
    const patientIds = [faker.string.uuid(), faker.string.uuid()];
    const orgsToUse: Record<OrgPrio, CQOrgHydrated[]> = {
      high: [],
      medium: [makeSimpleOrg(), makeSimpleOrg(), makeSimpleOrg(), makeSimpleOrg()],
      low: [],
    };
    const coverageEnhancer = new CoverageEnhancerLocal({
      patientLoader,
      orgs: orgsToUse,
    });
    getStatesFromPatientIds_mock.mockImplementationOnce(() => Promise.resolve([]));

    const result = await coverageEnhancer.getOrgsForPatients(cxId, patientIds);

    expect(result).toBeTruthy();
    expect(result.length).toEqual(4);
    expect(result).toEqual(expect.arrayContaining(orgsToUse.medium));
  });

  it("returns slice of medium when more items than allowed", async () => {
    const cxId = faker.string.uuid();
    const patientIds = [faker.string.uuid(), faker.string.uuid()];
    const orgsToUse: Record<OrgPrio, CQOrgHydrated[]> = {
      high: [],
      medium: new Array(defaultMaxOrgsToProcess * 2).fill(makeSimpleOrg()),
      low: [],
    };
    const coverageEnhancer = new CoverageEnhancerLocal({
      patientLoader,
      orgs: orgsToUse,
    });
    getStatesFromPatientIds_mock.mockImplementationOnce(() => Promise.resolve([]));

    const result = await coverageEnhancer.getOrgsForPatients(cxId, patientIds);

    expect(result).toBeTruthy();
    expect(result.length).toEqual(defaultMaxOrgsToProcess);
    expect(result).toEqual(expect.arrayContaining(orgsToUse.medium));
  });

  it("gets low prio orgs by state", async () => {
    const cxId = faker.string.uuid();
    const patientIds = [faker.string.uuid(), faker.string.uuid()];
    const statesToUse = ["CA", "FL", "IL", "NY"];
    const otherStates = ["MI", "OH", "TX", "WA"];
    const expectedOrgs = [
      makeSimpleOrg({ mockStates: statesToUse }),
      makeSimpleOrg({ mockStates: statesToUse }),
      makeSimpleOrg({ mockStates: statesToUse }),
    ];
    const orgsNotToReturn = [
      makeSimpleOrg({ mockStates: otherStates }),
      makeSimpleOrg({ mockStates: otherStates }),
    ];
    const orgsToUse: Record<OrgPrio, CQOrgHydrated[]> = {
      high: [],
      medium: [],
      low: [
        expectedOrgs[0]!,
        orgsNotToReturn[0]!,
        expectedOrgs[1]!,
        orgsNotToReturn[1]!,
        expectedOrgs[2]!,
      ],
    };
    const coverageEnhancer = new CoverageEnhancerLocal({
      patientLoader,
      orgs: orgsToUse,
      maxOrgsToProcess: 3,
    });
    getStatesFromPatientIds_mock.mockImplementationOnce(() => Promise.resolve(statesToUse));

    const result = await coverageEnhancer.getOrgsForPatients(cxId, patientIds);

    expect(result).toBeTruthy();
    expect(result.length).toEqual(3);
    expect(result).toEqual(expect.arrayContaining(expectedOrgs));
  });

  it("returns all medium plus low with matching state that fit the limit", async () => {
    const cxId = faker.string.uuid();
    const patientIds = [faker.string.uuid(), faker.string.uuid()];
    const statesToUse = ["CA", "FL", "IL", "NY"];
    const mediumToAdd = defaultMaxOrgsToProcess / 2;
    const lowMatchingStateToAdd = defaultMaxOrgsToProcess;
    const expectedAmountMedium = mediumToAdd;
    const expectedAmountLowMatching = defaultMaxOrgsToProcess / 2;
    const orgsToUse: Record<OrgPrio, CQOrgHydrated[]> = {
      high: [],
      medium: new Array(mediumToAdd).fill(makeSimpleOrg({ prio: "medium" })),
      low: new Array(lowMatchingStateToAdd).fill(
        makeSimpleOrg({ mockStates: statesToUse, prio: "low" })
      ),
    };
    const coverageEnhancer = new CoverageEnhancerLocal({
      patientLoader,
      orgs: orgsToUse,
    });
    getStatesFromPatientIds_mock.mockImplementationOnce(() => Promise.resolve(statesToUse));

    const result = await coverageEnhancer.getOrgsForPatients(cxId, patientIds);

    expect(result).toBeTruthy();
    expect(result.length).toEqual(defaultMaxOrgsToProcess);
    expect(result.filter(isMediumPrio).length).toEqual(expectedAmountMedium);
    expect(result.filter(isLowPrio).length).toEqual(expectedAmountLowMatching);
    expect(result).toEqual(expect.arrayContaining([...orgsToUse.medium, ...orgsToUse.low]));
  });

  it("returns all medium plus lower than limit low with matching state", async () => {
    const cxId = faker.string.uuid();
    const patientIds = [faker.string.uuid(), faker.string.uuid()];
    const statesToUse = ["CA", "FL", "IL", "NY"];
    const otherStates = ["MI", "OH", "TX", "WA"];
    const spotsToRemain = 5;
    const mediumToAdd = defaultMaxOrgsToProcess / 2;
    const lowMatchingStateToAdd = defaultMaxOrgsToProcess / 2 - spotsToRemain;
    const lowUnmatchingStateToAdd = defaultMaxOrgsToProcess;
    const expectedAmountMedium = mediumToAdd;
    const expectedAmountLowMatching = lowMatchingStateToAdd;
    const expectedLowOrgs = new Array(lowMatchingStateToAdd).fill(
      makeSimpleOrg({ mockStates: statesToUse, prio: "low" })
    );
    const lowOrgsNotToReturn = new Array(lowUnmatchingStateToAdd).fill(
      makeSimpleOrg({ mockStates: otherStates, prio: "low" })
    );
    const orgsToUse: Record<OrgPrio, CQOrgHydrated[]> = {
      high: [],
      medium: new Array(mediumToAdd).fill(makeSimpleOrg({ prio: "medium" })),
      low: [...lowOrgsNotToReturn, ...expectedLowOrgs],
    };
    const coverageEnhancer = new CoverageEnhancerLocal({
      patientLoader,
      orgs: orgsToUse,
      maxOrgsToProcess: defaultMaxOrgsToProcess - spotsToRemain,
    });
    getStatesFromPatientIds_mock.mockImplementationOnce(() => Promise.resolve(statesToUse));
    const result = await coverageEnhancer.getOrgsForPatients(cxId, patientIds);

    expect(result).toBeTruthy();
    expect(result.length).toEqual(defaultMaxOrgsToProcess - spotsToRemain);
    expect(result.filter(isMediumPrio).length).toEqual(expectedAmountMedium);
    expect(result.filter(isLowPrio).length).toEqual(expectedAmountLowMatching);
    expect(result).toEqual(expect.arrayContaining([...orgsToUse.medium, ...expectedLowOrgs]));
  });
});
