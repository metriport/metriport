import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { OpenSearchResponseHit } from "@metriport/core/external/opensearch";
import { FhirSearchResult } from "@metriport/core/external/opensearch/index-based-on-fhir";
import { OpenSearchFhirSearcherConfig } from "@metriport/core/external/opensearch/lexical/fhir-searcher";
import { createLexicalSearchQuery } from "@metriport/core/external/opensearch/lexical/query";
import { paginatedSearch } from "@metriport/core/external/opensearch/paginate";
import { Config } from "@metriport/core/util/config";
import { sleep } from "@metriport/core/util/sleep";
import { getEnvVarOrFail } from "@metriport/shared";
import { Client } from "@opensearch-project/opensearch";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { elapsedTimeAsStr } from "../shared/duration";

dayjs.extend(duration);

/**
 * Script to test the `paginatedSearch` function.
 *
 * If you want to test the `searchPatientConsolidated` function, use the `search-consolidated.ts` script.
 */

const cxId = getEnvVarOrFail("CX_ID");
const patientId = getEnvVarOrFail("PATIENT_ID");

async function main() {
  await sleep(50); // Give some time to avoid mixing logs w/ Node's
  const startedAt = Date.now();

  const searchQueryRaw = process.argv[2];
  if (!searchQueryRaw) {
    console.error("Please provide a search query as the first argument");
    process.exit(1);
  }

  console.log("Running search with: ", searchQueryRaw);

  const { endpoint, username, password } = getConfigs();
  const client = new Client({ node: endpoint, auth: { username, password } });
  const { searchQuery } = createLexicalSearchQuery({
    cxId,
    patientId,
    query: searchQueryRaw,
  });
  try {
    const resp = await paginatedSearch({
      client: client,
      indexName: "consolidated-data",
      searchRequest: searchQuery,
      pageSize: 3, // change to issue a single request or many, based on the server's data and query criteria
      mapResults: mapResultMap,
    });
    console.log("Search result count: ", resp.items.length);
  } catch (e) {
    console.error("Error ", e);
  }
  console.log(`>>> Done in ${elapsedTimeAsStr(startedAt)}`);
}

function mapResultMap(input: OpenSearchResponseHit<FhirSearchResult>[]): FhirSearchResult[] {
  if (!input) return [];
  return input.map(hit => {
    const entryId = hit._id;
    const source = hit._source;
    return {
      entryId,
      cxId: source.cxId,
      patientId: source.patientId,
      resourceType: source.resourceType,
      resourceId: source.resourceId,
      rawContent: source.rawContent,
    };
  });
}

function getConfigs(): OpenSearchFhirSearcherConfig {
  return {
    region: Config.getAWSRegion(),
    endpoint: Config.getSearchEndpoint(),
    indexName: Config.getConsolidatedSearchIndexName(),
    username: Config.getSearchUsername(),
    password: Config.getSearchPassword(),
  };
}

if (require.main === module) {
  main();
}
