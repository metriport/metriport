import { errorToString, MetriportError, sleep } from "@metriport/shared";
import { out } from "../../../util/log";
import { startDocumentQuery } from "../api/start-document-query";
import { DocumentQueryStarter, DocumentQueryStarterRequest } from "./document-query-starter";

/**
 * Direct implementation that executes document queries directly.
 *
 * This runs inside the lambda and executes the document query logic
 * without going through SQS.
 */
export class DocumentQueryStarterDirect implements DocumentQueryStarter {
  constructor(private readonly waitTimeInMillis = 0) {}

  async startDocumentQueries(requests: DocumentQueryStarterRequest[]): Promise<void> {
    if (requests.length < 1) return;

    const { log } = out(`DocumentQueryStarterDirect.startDocumentQueries`);
    const errors: unknown[] = [];
    for (const request of requests) {
      try {
        await startDocumentQuery(request);

        if (this.waitTimeInMillis > 0) await sleep(this.waitTimeInMillis);
      } catch (error) {
        log(
          `Failed to start document query for patient ${
            request.patientId
          } - reason: ${errorToString(error)}`
        );
        errors.push(error);
      }
    }
    if (errors.length > 0) {
      throw new MetriportError(
        `Failed to start ${errors.length} out of ${requests.length} document queries`
      );
    }
  }
}
