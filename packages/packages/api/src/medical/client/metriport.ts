import axios, { AxiosInstance } from "axios";

import { Organization } from "../models/organization";

export class MetriportMedicalApi {
  private api: AxiosInstance;
  private ORGANIZATION_URL = `/organization`;

  /**
   * Creates a new instance of the Metriport Medical API client.
   *
   * @param {string} apiKey - Your Metriport API key.
   */
  constructor(apiKey: string, baseURL = "https://api.metriport.com/medical/v1", secondaryAxios?) {
    if (axios) {
      this.api = axios.create({
        baseURL,
        headers: { "x-api-key": apiKey },
      });
    } else {
      this.api = secondaryAxios.create({
        baseURL,
        headers: { "x-api-key": apiKey },
      });
    }
  }

  /**
   * Creates an org or updates one if it already exists
   *
   * @param {Organization}    organization    - The org you want to create or update
   *
   * @returns The created or updated org.
   */
  async createOrUpdateOrganization(organization: Organization): Promise<Organization> {
    const resp = await this.api.post<Organization>(this.ORGANIZATION_URL, organization);

    if (!resp.data) throw new Error(`Create or update didn't return Organization`);
    return resp.data;
  }

  /**
   * Retrieve an organization
   *
   * @returns The organization or undefined.
   */
  async getOrganization(): Promise<Organization | undefined> {
    const resp = await this.api.get<Organization | undefined>(this.ORGANIZATION_URL);

    if (!resp.data) return undefined;
    return resp.data;
  }
}
