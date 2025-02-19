import { Client } from "@opensearch-project/opensearch";
import { out } from "../../util";
import { OpenSearchFileRemover, OpenSearchFileRemoverConfig } from "./file-remover";

export type OpenSearchFileRemoverDirectConfig = OpenSearchFileRemoverConfig & {
  endpoint: string;
  username: string;
  password: string;
};

export class OpenSearchFileRemoverDirect implements OpenSearchFileRemover {
  constructor(readonly config: OpenSearchFileRemoverDirectConfig) {}

  async remove(entryId: string): Promise<void> {
    const { indexName, endpoint, username, password } = this.config;
    const { log } = out(`OSFileRemover.remove - entryId ${entryId}`);

    const auth = { username, password };
    const client = new Client({ node: endpoint, auth });

    await client.delete({ index: indexName, id: entryId });
    log(`Successfully deleted ${entryId}`);
  }
}
