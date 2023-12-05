import { Carequality } from "@metriport/carequality-sdk/client/carequality";
import { sleep } from "@metriport/core/util/sleep";
import { createMockCQOrganization } from "../../../external/carequality/organization-mock";
import { Config } from "../../../shared/config";
import {
  CQDirectoryEntryDataWithUpdateAndId,
  createOrUpdateCQDirectoryEntries,
} from "./create-cq-directory-entry";
import { parseCQDirectoryEntries } from "./parse-cq-directory-entry";
import { capture } from "../../../shared/notifications";

const BATCH_SIZE = 300;

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
    } else {
      const apiKey = Config.getCQApiKey();
      const cq = new Carequality(apiKey);
      const resp = await cq.listAllOrganizations();
      orgs = parseCQDirectoryEntries(resp);
    }
    if (!orgs) return response;

    response.totalFetched = orgs.length;
    console.log("Parsed", orgs.length, "organizations for the CQ directory.");

    for (let i = 0; i <= orgs.length; i += BATCH_SIZE) {
      const batch = orgs.slice(i, i + BATCH_SIZE) as CQDirectoryEntryDataWithUpdateAndId[];
      const updResults = await createOrUpdateCQDirectoryEntries(batch);
      response.added += updResults.added;
      response.updated += updResults.updated;
      await sleep(750);
    }
  } catch (error) {
    const msg = `Failed rebuilding the CQ directory`;
    console.log(`${msg}, cause: ${error}`);
    capture.error(error, { extra: { context: `rebuildCQDirectory` } });
  }
  return response;
};
