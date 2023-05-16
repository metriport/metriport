import axios from "axios";
import { Config } from "../../shared/config";
import { Bundle } from "@medplum/fhirtypes";

const templateExt = "hbs";

export enum FHIRConverterSourceDataType {
  cda = "cda",
  hl7v2 = "hl7v2",
}

export enum FHIRConverterCDATemplate {
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
  template: FHIRConverterCDATemplate = FHIRConverterCDATemplate.ccd,
  keepUnusedSegments = false,
  keepInvalidAccess = false
): Promise<Bundle | undefined> {
  const fhirConverterUrl = Config.getFHIRConverterURL();
  if (!fhirConverterUrl) {
    console.log(`FHIR_CONVERTER_URL is not configured, skipping FHIR conversion...`);
    return;
  }

  const resp = await axios.post(
    `${fhirConverterUrl}/api/convert/${FHIRConverterSourceDataType.cda}/${template}.${templateExt}`,
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

  return resp.data.fhirResource;
}
