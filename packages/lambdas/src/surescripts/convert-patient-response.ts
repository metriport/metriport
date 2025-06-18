import { SurescriptsConvertPatientResponseHandlerDirect } from "@metriport/core/external/surescripts/command/convert-patient-response/convert-patient-response-direct";
import { SurescriptsJob } from "@metriport/core/external/surescripts/types";
import { capture } from "../shared/capture";
import { makeSurescriptsReplica } from "./shared";

capture.init();

export const handler = capture.wrapHandler(async (job: SurescriptsJob) => {
  const replica = makeSurescriptsReplica();
  const convertPatientResponseHandler = new SurescriptsConvertPatientResponseHandlerDirect(replica);
  const conversionBundle = await convertPatientResponseHandler.convertPatientResponse(job);
  return { conversionBundle };
});
