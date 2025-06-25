import { makeLambdaClient } from "../../../../external/aws/lambda";
import { Config } from "../../../../util/config";
import { out } from "../../../../util/log";
import { PatientImportResult, ProcessPatientResult } from "./patient-import-result";

export class PatientImportResultHandlerCloud implements PatientImportResult {
  constructor(
    private readonly patientResultLambdaName = Config.getPatientImportResultLambdaName(),
    private readonly lambdaClient = makeLambdaClient(Config.getAWSRegion())
  ) {}

  async processJobResult(params: ProcessPatientResult): Promise<void> {
    const { cxId, jobId } = params;
    const { log } = out(`PatientImport processPatientResult.cloud - cx ${cxId}, job ${jobId}`);

    log(`Invoking lambda ${this.patientResultLambdaName}`);
    const payload = JSON.stringify(params);

    // Intentionally only erroring if we fail to invoke the lambda, not if the lambda
    // execution fails (would use defaultLambdaInvocationResponseHandler for that)
    await this.lambdaClient
      .invoke({
        FunctionName: this.patientResultLambdaName,
        InvocationType: "Event",
        Payload: payload,
      })
      .promise();
  }
}
