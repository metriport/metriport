import { SurescriptsConvertBatchResponseHandlerDirect } from "@metriport/core/external/surescripts/command/convert-batch-response/convert-batch-response-direct";
import {
  SurescriptsRequester,
  SurescriptsFileIdentifier,
} from "@metriport/core/external/surescripts/types";
import { MetriportError } from "@metriport/shared";
import { capture } from "../shared/capture";
import { makeSurescriptsReplica } from "./shared";

capture.init();

export const handler = capture.wrapHandler(
  async (identifier: SurescriptsRequester & SurescriptsFileIdentifier) => {
    const replica = makeSurescriptsReplica();
    const convertBatchHandler = new SurescriptsConvertBatchResponseHandlerDirect(replica);
    try {
      const conversionBundles = await convertBatchHandler.convertBatchResponse(identifier);
      return { conversionBundles };
    } catch (error) {
      throw new MetriportError(`Failed to convert batch response: ${error}`, error, {
        ...identifier,
      });
    }
  }
);
