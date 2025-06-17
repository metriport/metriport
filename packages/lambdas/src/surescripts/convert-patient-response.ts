import { SurescriptsConvertPatientResponseHandlerDirect } from "@metriport/core/external/surescripts/command/convert-patient-response/convert-patient-response-direct";
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
    const convertPatientResponseHandler = new SurescriptsConvertPatientResponseHandlerDirect(
      replica
    );
    try {
      const conversionBundle = await convertPatientResponseHandler.convertPatientResponse(
        identifier
      );
      return { conversionBundle };
    } catch (error) {
      throw new MetriportError(`Failed to convert batch response: ${error}`, error, {
        ...identifier,
      });
    }
  }
);
