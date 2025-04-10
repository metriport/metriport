import { errorToString } from "@metriport/shared";
import {
  defaultLambdaInvocationResponseHandler,
  makeLambdaClient,
} from "../../../../external/aws/lambda";
import { Config } from "../../../../util/config";
import { out } from "../../../../util/log";
import { capture } from "../../../../util/notifications";
import { updateJobAtApi } from "../../api/update-job-status";
import { PatientImportResult, ProcessPatientResult } from "./patient-import-result";

const region = Config.getAWSRegion();
const lambdaClient = makeLambdaClient(region);

export class PatientImportResultHandlerCloud implements PatientImportResult {
  constructor(private readonly patientResultLambdaName: string) {}

  async processJobResult(params: ProcessPatientResult): Promise<void> {
    const { cxId, jobId } = params;
    const { log } = out(`PatientImport processPatientResult.cloud - cxId ${cxId} jobId ${jobId}`);
    try {
      const res = await lambdaClient
        .invoke({
          FunctionName: this.patientResultLambdaName,
          InvocationType: "Event",
          Payload: JSON.stringify(params),
        })
        .promise();
      const lambdaRespHandler = defaultLambdaInvocationResponseHandler({
        lambdaName: this.patientResultLambdaName,
      });
      lambdaRespHandler(res);
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
      await updateJobAtApi({ cxId, jobId, status: "failed" });
      throw error;
    }
  }
}
