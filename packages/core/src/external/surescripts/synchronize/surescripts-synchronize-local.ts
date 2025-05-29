import { sleep } from "@metriport/shared";
import { SurescriptsSftpClient } from "../client";
import {
  SurescriptsSynchronizeHandler,
  ProcessSynchronizeRequest,
} from "./surescripts-synchronize";

export class SurescriptsSynchronizeLocal implements SurescriptsSynchronizeHandler {
  constructor(private readonly waitTimeInMillis: number) {}

  async processSynchronize({ connect }: ProcessSynchronizeRequest): Promise<void> {
    const client = new SurescriptsSftpClient({});

    if (connect) {
      await client.connect();
      await client.disconnect();
    } else {
      await client.connect();
      // TODO: synchronization
      await client.disconnect();
    }

    if (this.waitTimeInMillis > 0) await sleep(this.waitTimeInMillis);
  }
}
