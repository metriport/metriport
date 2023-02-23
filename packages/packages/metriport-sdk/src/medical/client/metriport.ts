import axios, { AxiosInstance } from "axios";

export class MetriportMedicalApi {
  private api: AxiosInstance;

  /**
   * Creates a new instance of the Metriport API client.
   *
   * @param {string} apiKey - Your Metriport API key.
   */
  constructor(apiKey: string, baseURL = "https://api.metriport.com") {
    this.api = axios.create({
      baseURL,
      headers: { "x-api-key": apiKey },
    });
  }

  /**
   * Retries failed webhook requests.
   *
   * @returns void
   */
  async retryWebhookRequests(): Promise<void> {
    await this.api.post("/settings/webhook/retry");
  }
}
