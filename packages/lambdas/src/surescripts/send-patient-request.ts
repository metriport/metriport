import { SurescriptsSendPatientRequestHandlerDirect } from "@metriport/core/external/surescripts/command/send-patient-request/send-patient-request-direct";
import { SurescriptsPatientRequest } from "@metriport/core/external/surescripts/types";
import { capture } from "../shared/capture";
import { makeSurescriptsClient } from "./shared";

capture.init();

// Stub which will be integrated with Surescripts commands
export const handler = capture.wrapHandler(async (event: SurescriptsPatientRequest) => {
  const client = await makeSurescriptsClient();
  const handler = new SurescriptsSendPatientRequestHandlerDirect(client);
  await handler.sendPatientRequest(event);
});
