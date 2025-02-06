import { errorToString } from "@metriport/shared";
import { makeLambdaClient } from "../../../external/aws/lambda";
import { Config } from "../../../util/config";
import { out } from "../../../util/log";
import { capture } from "../../../util/notifications";
import { PatientImportParseHandler, StartPatientImportRequest } from "./patient-import-parse";

const region = Config.getAWSRegion();
const lambdaClient = makeLambdaClient(region);

export class PatientImportParseCloud implements PatientImportParseHandler {
  constructor(private readonly processPatientImportLambda: string) {}

  async startPatientImport(params: StartPatientImportRequest): Promise<void> {
    const { cxId, jobId } = params;
    const { log } = out(`startPatientImport.cloud - cxId ${cxId} jobId ${jobId}`);
    try {
      const payload = JSON.stringify(params);
      await lambdaClient
        .invoke({
          FunctionName: this.processPatientImportLambda,
          InvocationType: "Event",
          Payload: payload,
        })
        .promise();
      log(`Lambda invoked successfully - ${payload}`);
    } catch (error) {
      const msg = `Failure while starting patient import @ PatientImport`;
      log(`${msg}. Cause: ${errorToString(error)}`);
      capture.error(msg, {
        extra: {
          cxId,
          jobId,
          context: "patient-import-parse-cloud.startPatientImport",
          error,
        },
      });
      throw error;
    }
  }
}
