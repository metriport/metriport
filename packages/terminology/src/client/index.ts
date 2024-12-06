import * as dotenv from "dotenv";
dotenv.config();
import axios from "axios";
import { Parameters, ConceptMap, OperationOutcome } from "@medplum/fhirtypes";
import { getEnvVarOrFail } from "@metriport/shared";
import { CodeSystemLookupOutput } from "../operations/codeLookup";

export class TerminologyClient {
  private baseUrl: string;

  constructor() {
    this.baseUrl = getEnvVarOrFail("TERMINOLOGY_BASE_URL");
  }

  async lookupCode(parameters: Parameters): Promise<CodeSystemLookupOutput[]> {
    const response = await axios.post(`${this.baseUrl}/code-system/lookup`, parameters, {
      headers: {
        "Content-Type": "application/json",
      },
    });
    return response.data;
  }

  async lookupPartialCode(parameters: Parameters): Promise<CodeSystemLookupOutput[]> {
    const response = await axios.post(`${this.baseUrl}/code-system/lookup/partial`, parameters, {
      headers: {
        "Content-Type": "application/json",
      },
    });
    return response.data;
  }

  async importCode(parameters: Parameters): Promise<OperationOutcome[]> {
    const response = await axios.post(`${this.baseUrl}/code-system/import`, parameters, {
      headers: {
        "Content-Type": "application/json",
      },
    });
    return response.data;
  }

  async importConceptMap(conceptMap: ConceptMap): Promise<ConceptMap[] | OperationOutcome[]> {
    const response = await axios.post(`${this.baseUrl}/concept-map/import`, conceptMap, {
      headers: {
        "Content-Type": "application/json",
      },
    });
    return response.data;
  }

  async translateCode(parameters: Parameters): Promise<ConceptMap | OperationOutcome[]> {
    const response = await axios.post(`${this.baseUrl}/concept-map/translate`, parameters, {
      headers: {
        "Content-Type": "application/json",
      },
    });
    return response.data;
  }
}
