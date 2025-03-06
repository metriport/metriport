import { errorToString } from "@metriport/shared";
import {
  defaultLambdaInvocationResponseHandler,
  makeLambdaClient,
} from "../../../../external/aws/lambda";
import { Config } from "../../../../util/config";
import { processAsyncError } from "../../../../util/error/shared";
import { out } from "../../../../util/log";
import { capture } from "../../../../util/notifications";
import { PatientImportResult, ProcessPatientResult } from "./patient-import-result";

const region = Config.getAWSRegion();
const lambdaClient = makeLambdaClient(region);

export class PatientImportResultHandlerCloud implements PatientImportResult {
  constructor(private readonly patientResultLambdaName: string) {}

  async processPatientResult(params: ProcessPatientResult): Promise<void> {
    const { cxId, jobId } = params;
    const { log } = out(`PatientImport processPatientResult.cloud - cxId ${cxId} jobId ${jobId}`);
    try {
      lambdaClient
        .invoke({
          FunctionName: this.patientResultLambdaName,
          InvocationType: "Event",
          Payload: JSON.stringify(params),
        })
        .promise()
        .then(
          defaultLambdaInvocationResponseHandler({
            lambdaName: this.patientResultLambdaName,
          })
        )
        .catch(
          processAsyncError(
            "Failed to invoke lambda to generate the result of the bulk patient import"
          )
        );
    } catch (error) {
      const msg = `Failure while processing patient result @ PatientImport`;
      log(`${msg}. Cause: ${errorToString(error)}`);
      capture.error(msg, {
        extra: {
          cxId,
          jobId,
          context: "patient-import-result-cloud.processPatientResult",
          error,
        },
      });
      throw error;
    }
  }
}
