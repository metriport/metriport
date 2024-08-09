import * as dotenv from "dotenv";
dotenv.config();
import axios from "axios";
import { Parameters } from "@medplum/fhirtypes";
import { getEnvVar } from "@metriport/shared";

export class TerminologyClient {
  private baseUrl: string;

  constructor() {
    this.baseUrl = getEnvVar("TERMINOLOGY_BASE_URL") ?? "http://127.0.0.1:3000/fhir/R4";
  }

  // TODO: ADD RETURN TYPES
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async lookup(parameters: Parameters): Promise<any> {
    const response = await axios.post(`${this.baseUrl}/CodeSystem/lookup`, parameters, {
      headers: {
        "Content-Type": "application/json",
      },
    });
    return response.data;
  }

  // TODO: ADD RETURN TYPES
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async import(parameters: Parameters): Promise<any> {
    const response = await axios.post(`${this.baseUrl}/CodeSystem/import`, parameters, {
      headers: {
        "Content-Type": "application/json",
      },
    });
    return response.data;
  }
}
