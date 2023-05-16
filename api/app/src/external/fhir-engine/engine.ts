import axios from "axios";
import { Config } from "../../shared/config";
import { Bundle } from "@medplum/fhirtypes";

const templateExt = "hbs";

export enum FHIREngineSourceDataType {
  cda = "cda",
  hl7v2 = "hl7v2",
}

export enum FHIREngineCDATemplate {
  ccd = "ccd",
  consultationNote = "ConsultationNote",
  dischargeSummary = "DischargeSummary",
  header = "Header",
  historyandPhysical = "HistoryandPhysical",
  operativeNote = "OperativeNote",
  procedureNote = "ProcedureNote",
  progressNote = "ProgressNote",
  referralNote = "ReferralNote",
  transferSummary = "TransferSummary",
}

export async function convertCDAToFHIR(
  patientId: string,
  cda: string,
  template: FHIREngineCDATemplate = FHIREngineCDATemplate.ccd,
  keepUnusedSegments = false,
  keepInvalidAccess = false
): Promise<Bundle | undefined> {
  const fhirEngineUrl = Config.getFHIREngineURL();
  if (!fhirEngineUrl) {
    console.log(`FHIR_ENGINE_URL is not configured, skipping FHIR conversion...`);
    return;
  }

  const resp = await axios.post(
    `${fhirEngineUrl}/api/convert/${FHIREngineSourceDataType.cda}/${template}.${templateExt}`,
    cda,
    {
      params: {
        unusedSegments: `${keepUnusedSegments}`,
        invalidAccess: `${keepInvalidAccess}`,
        patientId,
      },
      headers: { "Content-Type": "text/plain" },
    }
  );

  return resp.data;
}
