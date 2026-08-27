import path from "path";
import fs from "fs";
import { initRunsFolder } from "../../shared/folder";
import { buildDayjs } from "@metriport/shared/common/date";
import { Bundle } from "@medplum/fhirtypes";

export interface AiSummaryOutput {
  summary: string;
  durationInMs: number;
  inputTokensUsed?: number;
  outputTokensUsed?: number;
}

export function startComparisonCsv(providers: readonly string[]): {
  summaryFile: string;
  comparisonId: string;
} {
  const comparisonId = `${providers.join("-")}-${buildDayjs().format("YYYY-MM-DD_HH-mm-ss")}`;
  const summaryDir = initRunsFolder(`summary-compare/${comparisonId}`);
  const summaryFile = path.join(summaryDir, "summary.csv");
  fs.writeFileSync(
    summaryFile,
    `patient ID,consolidated bundle size,${providers
      .map(p => `${p} input tokens,${p} output tokens,${p} duration`)
      .join(",")}\n`
  );
  return { summaryFile, comparisonId };
}

export function addToComparisonSummary(
  csvPath: string,
  patientId: string,
  consolidatedBundle: Bundle,
  summaries: AiSummaryOutput[]
) {
  fs.appendFileSync(
    csvPath,
    `${patientId},${consolidatedBundle.entry?.length ?? 0},${summaries
      .map(s => `${s.inputTokensUsed},${s.outputTokensUsed},${s.durationInMs}`)
      .join(",")}\n`
  );
}

export function addToComparisonOutput(
  comparisonId: string,
  patientId: string,
  providers: readonly string[],
  summaries: AiSummaryOutput[]
): void {
  const patientDir = initPatientDir(comparisonId, patientId);
  for (let i = 0; i < providers.length; i++) {
    const provider = providers[i];
    const summary = summaries[i];
    fs.writeFileSync(path.join(patientDir, `${provider}.txt`), summary.summary, "utf-8");
  }
}

export function getAiSummaries(
  comparisonId: string,
  patientId: string
): { provider: string; summary: string }[] {
  const patientDir = initPatientDir(comparisonId, patientId);
  const aiSummaryFileNames = fs
    .readdirSync(patientDir)
    .filter(fileName => fileName.endsWith(".txt"));
  return aiSummaryFileNames.map(fileName => {
    const provider = fileName.replace(".txt", "");
    const summary = fs.readFileSync(path.join(patientDir, fileName), "utf-8");
    return { provider, summary };
  });
}

export function initPatientDir(comparisonId: string, patientId: string): string {
  return initRunsFolder(`summary-compare/${comparisonId}/patient/${patientId}`);
}
