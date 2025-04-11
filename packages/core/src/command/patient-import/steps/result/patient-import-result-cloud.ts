import { makeLambdaClient } from "../../../../external/aws/lambda";
import { Config } from "../../../../util/config";
import { out } from "../../../../util/log";
import { PatientImportResult, ProcessPatientResult } from "./patient-import-result";

const region = Config.getAWSRegion();
const lambdaClient = makeLambdaClient(region);

export class PatientImportResultHandlerCloud implements PatientImportResult {
  constructor(private readonly patientResultLambdaName: string) {}

  async processJobResult(params: ProcessPatientResult): Promise<void> {
    const { cxId, jobId } = params;
    const { log } = out(`PatientImport processPatientResult.cloud - cxId ${cxId} jobId ${jobId}`);

    const payload = JSON.stringify(params);
    log(`Invoking lambda ${this.patientResultLambdaName} with payload ${payload}`);

    // Intentionally only erroring if we fail to invoke the lambda, not if the lambda
    // execution fails (would use defaultLambdaInvocationResponseHandler for that)
    await lambdaClient
      .invoke({
        FunctionName: this.patientResultLambdaName,
        InvocationType: "Event",
        Payload: payload,
      })
      .promise();
  }
}
