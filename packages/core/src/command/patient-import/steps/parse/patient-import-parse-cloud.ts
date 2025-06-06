import { makeLambdaClient } from "../../../../external/aws/lambda";
import { Config } from "../../../../util/config";
import { out } from "../../../../util/log";
import { PatientImportParse, PatientImportParseRequest } from "./patient-import-parse";

const region = Config.getAWSRegion();
const lambdaClient = makeLambdaClient(region);

export class PatientImportParseCloud implements PatientImportParse {
  constructor(private readonly jobParseLambda: string) {}

  async processJobParse(params: PatientImportParseRequest): Promise<void> {
    const { cxId, jobId } = params;
    const { log } = out(`PatientImport processJobParse.cloud - cx ${cxId}, job ${jobId}`);

    log(`Invoking lambda ${this.jobParseLambda}`);
    const payload = JSON.stringify(params);
    // Intentionally only erroring if we fail to invoke the lambda, not if the lambda
    // execution fails (would use defaultLambdaInvocationResponseHandler for that)
    await lambdaClient
      .invoke({
        FunctionName: this.jobParseLambda,
        InvocationType: "Event",
        Payload: payload,
      })
      .promise();
  }
}
