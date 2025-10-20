import { executeWithNetworkRetries } from "@metriport/shared";
import axios, { AxiosInstance } from "axios";
import { out } from "../../util/log";
import { ConversionResultHandler, ConversionResultWithCount } from "./types";

const MAX_API_NOTIFICATION_ATTEMPTS = 5;

export class ConversionResultLocal implements ConversionResultHandler {
  private readonly api: AxiosInstance;
  private readonly docProgressURL = `/internal/docs/conversion-status`;

  constructor(readonly apiUrl: string) {
    this.api = axios.create({ baseURL: apiUrl });
  }

  async notifyApi(params: ConversionResultWithCount, logParam?: typeof console.log): Promise<void> {
    const { cxId, patientId, jobId } = params;
    const { log } = logParam
      ? { log: logParam }
      : out(`notifyApi.local - cx ${cxId} patient ${patientId} job ${jobId}`);
    log(`Notifying API on ${this.docProgressURL} w/ ${JSON.stringify(params)}`);
    await executeWithNetworkRetries(() => this.api.post(this.docProgressURL, null, { params }), {
      retryOnTimeout: true,
      maxAttempts: MAX_API_NOTIFICATION_ATTEMPTS,
    });
  }
}
