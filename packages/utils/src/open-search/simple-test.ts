import { Client } from "@opensearch-project/opensearch";

/**
 * Test script to perform simple operations on OpenSearch.
 */

const username = "admin";
const password = "admin";
const host = "localhost:9200";
const indexName = "test";

async function main() {
  const client = new Client({
    node: "https://" + host,
    auth: { username, password },
  });

  // create index if it doesn't already exist
  const exists = Boolean((await client.indices.exists({ index: indexName })).body);
  console.log(`Index exists: ${JSON.stringify(exists)}`);
  if (!exists) {
    const body = {
      mappings: {
        properties: {
          fileName: { type: "keyword" },
          content: { type: "text" },
          patientId: { type: "text" },
        },
      },
    };
    console.log(`Creating the index ${indexName}...`);
    const res = (await client.indices.create({ index: indexName, body })).body;
    console.log(`Success: ${JSON.stringify(res, null, 2)}:`);
  }

  // add a document to the index
  const document = {
    fileName:
      "fdasfasfds-fdafdsfdsa_jhjghjhgjghjhg-jhgjghghjhg_r4r4rr4r4f3fr43rr4r-r4r433r4r4r34r3",
    content: "This is a test",
    patientId: "1234567890",
  };
  const response = await client.index({
    id: "1",
    index: indexName,
    body: document,
  });
  console.log(response.body);

  // delete the index
  console.log((await client.indices.delete({ index: indexName })).body);
}

main();
