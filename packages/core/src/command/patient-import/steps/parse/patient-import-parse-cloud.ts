import { errorToString } from "@metriport/shared";
import {
  defaultLambdaInvocationResponseHandler,
  makeLambdaClient,
} from "../../../../external/aws/lambda";
import { Config } from "../../../../util/config";
import { out } from "../../../../util/log";
import { capture } from "../../../../util/notifications";
import { PatientImportParse, PatientImportParseRequest } from "./patient-import-parse";

const region = Config.getAWSRegion();
const lambdaClient = makeLambdaClient(region);

export class PatientImportParseCloud implements PatientImportParse {
  constructor(private readonly jobParseLambda: string) {}

  async processJobParse(params: PatientImportParseRequest): Promise<void> {
    const { cxId, jobId } = params;
    const { log } = out(`PatientImport processJobParse.cloud - cxId ${cxId} jobId ${jobId}`);
    try {
      const payload = JSON.stringify(params);
      log(`Invoking lambda w/ payload: ${payload}`);
      await lambdaClient
        .invoke({
          FunctionName: this.jobParseLambda,
          InvocationType: "Event",
          Payload: payload,
        })
        .promise()
        .then(defaultLambdaInvocationResponseHandler({ lambdaName: this.jobParseLambda }));
    } catch (error) {
      const msg = `Failure while parsing the job of patient import @ PatientImport`;
      log(`${msg}. Cause: ${errorToString(error)}`);
      capture.error(msg, {
        extra: {
          cxId,
          jobId,
          context: "patient-import-parse-cloud.processJobParse",
          error,
        },
      });
      throw error;
    }
  }
}
