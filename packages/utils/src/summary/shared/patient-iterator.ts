import fs from "fs";
import path from "path";
import { Bundle } from "@medplum/fhirtypes";
import { getConsolidatedBundle, getAiSummary } from "./consolidated-bundle";
import { initRunsFolder } from "../../shared/folder";
import { isValidUuid } from "@metriport/shared/util";
import { getAiSummaries } from "./compare";

export interface PatientConsolidated {
  patientId: string;
  consolidatedBundle?: Bundle | undefined;
  existingAiSummary?: string | undefined;
  index: number;
  nextPatientId?: string;
  previousPatientId?: string;
}

export async function* eachPatient(
  cxId: string,
  patientIds: ReadonlyArray<string>
): AsyncIterable<PatientConsolidated> {
  for (let index = 0; index < patientIds.length; index++) {
    const patientId = patientIds[index];
    const nextPatientId = index < patientIds.length - 1 ? patientIds[index + 1] : undefined;
    const previousPatientId = index > 0 ? patientIds[index - 1] : undefined;
    const consolidatedBundle = await getConsolidatedBundle(cxId, patientId);
    const existingAiSummary = consolidatedBundle ? getAiSummary(consolidatedBundle) : undefined;
    yield {
      patientId,
      consolidatedBundle,
      existingAiSummary,
      index,
      nextPatientId,
      previousPatientId,
    };
  }
}

export interface PatientInComparison {
  patientId: string;
  nextPatientId?: string;
  previousPatientId?: string;
  summaries: { provider: string; summary: string }[];
}

export async function* eachPatientInComparison(
  comparisonId: string
): AsyncIterable<PatientInComparison> {
  const compareDir = initRunsFolder(`summary-compare/${comparisonId}`);
  const patientDir = path.join(compareDir, "patient");
  if (!fs.existsSync(patientDir)) {
    throw new Error(`Benchmark directory ${comparisonId} not found`);
  }
  const patientIds = fs.readdirSync(patientDir).filter(isValidUuid);
  for (let i = 0; i < patientIds.length; i++) {
    const patientId = patientIds[i];
    const nextPatientId = i < patientIds.length - 1 ? patientIds[i + 1] : undefined;
    const previousPatientId = i > 0 ? patientIds[i - 1] : undefined;
    const summaries = getAiSummaries(comparisonId, patientId);
    yield {
      patientId,
      nextPatientId,
      previousPatientId,
      summaries,
    };
  }
}
