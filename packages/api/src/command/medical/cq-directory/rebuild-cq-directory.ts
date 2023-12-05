import { Carequality } from "@metriport/carequality-sdk/client/carequality";
import { sleep } from "@metriport/core/util/sleep";
import { Config } from "../../../shared/config";
import { capture } from "../../../shared/notifications";
import {
  CQDirectoryEntryDataWithUpdateAndId,
  createOrUpdateCQDirectoryEntries,
} from "./create-cq-directory-entry";
import { parseCQDirectoryEntries } from "./parse-cq-directory-entry";

const BATCH_SIZE = 300;

type CQDirectoryRebuildResponse = {
  totalFetched: number;
  added: number;
  updated: number;
};

export const rebuildCQDirectory = async (): Promise<CQDirectoryRebuildResponse | undefined> => {
  let orgs;
  const response: CQDirectoryRebuildResponse = {
    totalFetched: 0,
    added: 0,
    updated: 0,
  };

  try {
    const apiKey = Config.getCQApiKey();
    const cq = new Carequality(apiKey);
    const resp = await cq.listAllOrganizations();
    orgs = parseCQDirectoryEntries(resp);

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
