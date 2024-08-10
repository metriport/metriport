import * as dotenv from "dotenv";
dotenv.config();
import axios from "axios";
import { Parameters, ConceptMap, OperationOutcome } from "@medplum/fhirtypes";
import { getEnvVar } from "@metriport/shared";
import { CodeSystemLookupOutput } from "../operations/codeLookup";

export class TerminologyClient {
  private baseUrl: string;

  constructor() {
    this.baseUrl = getEnvVar("TERMINOLOGY_BASE_URL") ?? "http://127.0.0.1:3000/fhir/R4";
  }

  async lookupCode(parameters: Parameters): Promise<CodeSystemLookupOutput | OperationOutcome[]> {
    const response = await axios.post(`${this.baseUrl}/CodeSystem/lookup`, parameters, {
      headers: {
        "Content-Type": "application/json",
      },
    });
    return response.data;
  }

  async importCode(parameters: Parameters): Promise<OperationOutcome[]> {
    const response = await axios.post(`${this.baseUrl}/CodeSystem/import`, parameters, {
      headers: {
        "Content-Type": "application/json",
      },
    });
    return response.data;
  }

  async importConceptMap(conceptMap: ConceptMap): Promise<ConceptMap[] | OperationOutcome[]> {
    const response = await axios.post(`${this.baseUrl}/ConceptMap/import`, conceptMap, {
      headers: {
        "Content-Type": "application/json",
      },
    });
    return response.data;
  }

  async translateCode(parameters: Parameters): Promise<ConceptMap | OperationOutcome[]> {
    const response = await axios.post(`${this.baseUrl}/ConceptMap/translate`, parameters, {
      headers: {
        "Content-Type": "application/json",
      },
    });
    return response.data;
  }
}
