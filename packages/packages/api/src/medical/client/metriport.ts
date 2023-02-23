import axios, { AxiosInstance } from "axios";

export class MetriportMedicalApi {
  private api: AxiosInstance;

  /**
   * Creates a new instance of the Metriport Medical API client.
   *
   * @param {string} apiKey - Your Metriport API key.
   */
  constructor(apiKey: string, baseURL = "https://api.metriport.com/medical/v1") {
    this.api = axios.create({
      baseURL,
      headers: { "x-api-key": apiKey },
    });
  }
}
