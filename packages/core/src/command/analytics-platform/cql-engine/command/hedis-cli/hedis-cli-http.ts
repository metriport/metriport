import { executeWithNetworkRetries } from "@metriport/shared";
import axios from "axios";
import { Config } from "../../../../../util/config";
import { out } from "../../../../../util/log";
import { HedisCliHandler, InvokeHedisCliRequest, InvokeHedisCliServiceRequest } from "./hedis-cli";

export class HedisCliHttp implements HedisCliHandler {
  constructor(private readonly httpEndpoint: string = Config.getHedisCliTransformHttpEndpoint()) {}

  async invokeHedisCli({
    patientBundleS3Key,
    measureName,
    outputMeasureReportS3Path,
    mode,
    parameters,
    timeoutInMillis,
  }: InvokeHedisCliRequest): Promise<void> {
    const { log } = out(`HedisCliHttp.invokeHedisCli - measure ${measureName}`);

    log(`Calling HTTP endpoint ${this.httpEndpoint}/execute`);

    const payload: InvokeHedisCliServiceRequest = {
      patientBundleS3Key,
      measureName,
      outputMeasureReportS3Path,
      mode: mode ?? "engine",
      parameters: parameters ?? {},
    };

    await executeWithNetworkRetries(async () => {
      const response = await axios.post(`${this.httpEndpoint}/execute`, payload, {
        headers: { "Content-Type": "application/json" },
        ...(timeoutInMillis !== undefined ? { timeout: timeoutInMillis } : {}),
      });
      return response.data;
    });
  }
}
