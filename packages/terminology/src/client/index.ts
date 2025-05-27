import { ConceptMap, OperationOutcome, Parameters } from "@medplum/fhirtypes";
import { getEnvVarOrFail } from "@metriport/shared";
import axios from "axios";
import * as dotenv from "dotenv";
import { CodeSystemLookupOutput } from "../operations/codeLookup";
dotenv.config();

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
    return response.data.response;
  }

  async importCode(parameters: Parameters, isOverwrite = false): Promise<OperationOutcome[]> {
    const response = await axios.post(`${this.baseUrl}/code-system/import`, parameters, {
      headers: {
        "Content-Type": "application/json",
      },
      params: { isOverwrite },
    });
    return response.data;
  }

  async importConceptMap(
    conceptMap: ConceptMap,
    isReversible: boolean
  ): Promise<ConceptMap[] | OperationOutcome[]> {
    const response = await axios.post(`${this.baseUrl}/concept-map`, conceptMap, {
      headers: {
        "Content-Type": "application/json",
      },
      params: { isReversible },
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
