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

  async importCode(parameters: Parameters, isOverwrite = false): Promise<OperationOutcome[]> {
    const response = await axios.post(
      `${this.baseUrl}/code-system/import?isOverwrite=${isOverwrite}`,
      parameters,
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
    return response.data;
  }

  async importConceptMap(
    conceptMap: ConceptMap,
    isReversible: boolean
  ): Promise<ConceptMap[] | OperationOutcome[]> {
    const queryParams = new URLSearchParams();
    queryParams.set("isReversible", isReversible.toString());

    const response = await axios.post(
      `${this.baseUrl}/concept-map/import?${queryParams.toString()}`,
      conceptMap,
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
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
