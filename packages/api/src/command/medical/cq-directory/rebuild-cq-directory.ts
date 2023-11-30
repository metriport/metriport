import { Carequality } from "@metriport/carequality-sdk/client/carequality";
import { sleep } from "@metriport/core/util/sleep";
import { createMockCQOrganization } from "../../../external/carequality/organization-mock";
import { Config } from "../../../shared/config";
import { createOrUpdateCQDirectoryEntries } from "./create-cq-directory-entry";
import { parseCQDirectoryEntries } from "./parse-cq-directory-entry";

const BATCH_SIZE = 100;

type CQDirectoryRebuildResponse = {
  totalFetched: number;
  added: number;
  updated: number;
};

export const rebuildCQDirectory = async (
  mockNumber: number | undefined
): Promise<CQDirectoryRebuildResponse | undefined> => {
  let orgs;
  const response: CQDirectoryRebuildResponse = {
    totalFetched: 0,
    added: 0,
    updated: 0,
  };

  try {
    if (mockNumber) {
      const mockOrganizations = [];

      for (let j = 0; j < mockNumber; j++) {
        const fakeOrg = createMockCQOrganization();
        const mockOrgJson = JSON.parse(fakeOrg);
        mockOrganizations.push(mockOrgJson);
      }
      orgs = parseCQDirectoryEntries(mockOrganizations);
      response.totalFetched = orgs.length;
      console.log(`Total fetched: ${response.totalFetched}`);
    } else {
      const apiKey = Config.getCQApiKey();
      const cq = new Carequality(apiKey);
      const resp = await cq.listAllOrganizations();
      orgs = parseCQDirectoryEntries(resp);
    }
    console.log("ORGS LENGTH", orgs.length);
    if (!orgs) return response;

    response.totalFetched = orgs.length;

    console.log("Orgs parsed", orgs.length);

    const updResults = [];
    for (let i = 0; i <= orgs.length; i += BATCH_SIZE) {
      const batch = orgs.slice(i, i + BATCH_SIZE);
      updResults.push(await createOrUpdateCQDirectoryEntries(batch));
      await sleep(500);
    }

    updResults.forEach(result => {
      result.forEach(org => {
        org.updated ? response.updated++ : response.added++;
      });
    });
  } catch (error) {
    console.log("ERROR", error);
  }
  return response;
};
