import fs from "fs";
import path from "path";
import { Bundle } from "@medplum/fhirtypes";
import { initRunsFolder } from "../shared/folder";
import { executeAsynchronously } from "@metriport/core/util/concurrency";
import { ExtractionBundle, ExtractionSource } from "@metriport/core/sde/types";
import { listDocumentIds } from "@metriport/core/sde/command/document/list-documents";
import { downloadDocumentConversion } from "@metriport/core/sde/command/document/download";

function getLocalDirectoryPath(directoryName: string) {
  initRunsFolder("sde");
  const localDirectoryPath = path.join(process.cwd(), "runs/sde", directoryName);
  if (!fs.existsSync(localDirectoryPath)) {
    fs.mkdirSync(localDirectoryPath, { recursive: true });
  }
  return localDirectoryPath;
}

export function savePatientIds(cxId: string, patientIds: string[]): void {
  const localDirectoryPath = getLocalDirectoryPath("patient-ids");
  const filePath = path.join(localDirectoryPath, `${cxId}.json`);
  fs.writeFileSync(filePath, JSON.stringify(patientIds, null, 2), "utf8");
}

export function loadPatientIds(cxId: string): string[] {
  const localDirectoryPath = getLocalDirectoryPath("patient-ids");
  const filePath = path.join(localDirectoryPath, `${cxId}.json`);
  if (!fs.existsSync(filePath)) {
    return [];
  }
  const patientIds = JSON.parse(fs.readFileSync(filePath, "utf8"));
  return patientIds;
}

export function localPatientDirectoryExists(cxId: string, patientId: string): boolean {
  const localDirectoryPath = getLocalDirectoryPath(`customer/${cxId}`);
  return fs.existsSync(path.join(localDirectoryPath, patientId));
}

export function listLocalCustomerIds(): string[] {
  const localDirectoryPath = getLocalDirectoryPath("customer");
  return fs.readdirSync(localDirectoryPath);
}

export function listLocalPatientIds(cxId: string): string[] {
  const localDirectoryPath = getLocalDirectoryPath(`customer/${cxId}`);
  return fs.readdirSync(localDirectoryPath);
}

export function listLocalDocumentIds(cxId: string, patientId: string): string[] {
  const localDirectoryPath = getLocalDirectoryPath(`customer/${cxId}/${patientId}`);
  return fs.readdirSync(localDirectoryPath).map(fileName => path.basename(fileName, ".json"));
}

export function getLocalDocument(cxId: string, patientId: string, documentId: string): Bundle {
  const localDirectoryPath = getLocalDirectoryPath(`customer/${cxId}/${patientId}`);
  const filePath = path.join(localDirectoryPath, `${documentId}.json`);
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

export function saveConversionBundle({
  cxId,
  patientId,
  documentId,
  bundle,
}: {
  cxId: string;
  patientId: string;
  documentId: string;
  bundle: Bundle;
}) {
  const localDirectoryPath = getLocalDirectoryPath(`customer/${cxId}/${patientId}`);
  const filePath = path.join(localDirectoryPath, `${documentId}.json`);
  fs.writeFileSync(filePath, JSON.stringify(bundle), "utf8");
}

export function saveConversionBundles({
  cxId,
  patientId,
  bundles,
}: {
  cxId: string;
  patientId: string;
  bundles: ExtractionBundle[];
}) {
  const localDirectoryPath = getLocalDirectoryPath(`customer/${cxId}/${patientId}`);
  bundles.forEach(bundle => {
    const filePath = path.join(localDirectoryPath, `${bundle.extractedFromDocumentId}.json`);
    fs.writeFileSync(filePath, JSON.stringify(bundle.extractedBundle), "utf8");
  });
}

export function saveExtractionSources({
  cxId,
  patientId,
  sources,
}: {
  cxId: string;
  patientId: string;
  sources: ExtractionSource[];
}) {
  const localDirectoryPath = getLocalDirectoryPath(`source/${cxId}/${patientId}`);
  const filePath = path.join(localDirectoryPath, "sources.json");
  fs.writeFileSync(filePath, JSON.stringify(sources), "utf8");
}

export function loadExtractionSources(cxId: string, patientId: string): ExtractionSource[] {
  const localDirectoryPath = getLocalDirectoryPath(`source/${cxId}/${patientId}`);
  const filePath = path.join(localDirectoryPath, "sources.json");
  if (!fs.existsSync(filePath)) {
    return [];
  }
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

export function scanDocuments(cxId: string, handler: (bundle: ExtractionBundle) => void) {
  const localDirectoryPath = getLocalDirectoryPath(`customer/${cxId}`);
  const patientIds = fs.readdirSync(localDirectoryPath);
  patientIds.forEach(patientId => {
    const patientDirectoryPath = path.join(localDirectoryPath, patientId);
    const documentFileNames = fs.readdirSync(patientDirectoryPath);
    documentFileNames.forEach(documentFileName => {
      const documentFilePath = path.join(patientDirectoryPath, documentFileName);
      const bundle = JSON.parse(fs.readFileSync(documentFilePath, "utf8"));
      handler(bundle);
    });
  });
}

export async function downloadAllDocumentConversions({
  cxId,
  patientId,
  downloadInParallel = 10,
}: {
  cxId: string;
  patientId: string;
  downloadInParallel?: number;
}): Promise<ExtractionBundle[]> {
  const documentIds = await listDocumentIds({ cxId, patientId });
  console.log(`Downloading ${documentIds.length} documents for patient ${patientId}`);

  const extractionBundles: ExtractionBundle[] = [];
  await executeAsynchronously(
    documentIds,
    async documentId => {
      const bundle = await downloadDocumentConversion({ cxId, patientId, documentId });
      if (bundle) {
        extractionBundles.push({ extractedFromDocumentId: documentId, extractedBundle: bundle });
      }
    },
    {
      numberOfParallelExecutions: downloadInParallel,
    }
  );

  console.log(`Downloaded ${extractionBundles.length} bundles for patient ${patientId}`);
  return extractionBundles;
}
