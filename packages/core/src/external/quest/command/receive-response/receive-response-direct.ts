import { QuestReceiveResponseHandler } from "./receive-response";
import { QuestSftpClient } from "../../client";
import { QuestJob } from "../../types";
// import { buildConvertBatchResponseHandler } from "../convert-batch-response/convert-batch-response-factory";

export class QuestReceiveResponseHandlerDirect implements QuestReceiveResponseHandler {
  constructor(
    private readonly client: QuestSftpClient = new QuestSftpClient() // private readonly next = buildConvertBatchResponseHandler()
  ) {}

  async receiveResponse(job: QuestJob): Promise<void> {
    await this.client.receiveResponse(job);
    // if (responseFile) {
    //   await this.next.convertBatchResponse(job);
    // }
  }
}
