import fs from "fs";
import path from "path";
import { Bundle } from "@medplum/fhirtypes";
import { ExtractionBundle } from "@metriport/core/external/sde/types";

function getLocalDirectoryPath(directoryName: string) {
  const localDirectoryPath = path.join(process.cwd(), "runs/sde", directoryName);
  if (!fs.existsSync(localDirectoryPath)) {
    fs.mkdirSync(localDirectoryPath, { recursive: true });
  }
  return localDirectoryPath;
}

export function savePatientIds(cxId: string, patientIds: string[]): void {
  const localDirectoryPath = getLocalDirectoryPath(`customer/${cxId}`);
  const filePath = path.join(localDirectoryPath, "patient-ids.json");
  fs.writeFileSync(filePath, JSON.stringify(patientIds, null, 2), "utf8");
}

export function loadPatientIds(cxId: string): string[] {
  const localDirectoryPath = getLocalDirectoryPath(`customer/${cxId}`);
  const filePath = path.join(localDirectoryPath, "patient-ids.json");
  if (!fs.existsSync(filePath)) {
    return [];
  }
  const ids = JSON.parse(fs.readFileSync(filePath, "utf8"));
  if (!Array.isArray(ids)) {
    return [];
  }
  return ids;
}

export function localPatientDirectoryExists(cxId: string, patientId: string): boolean {
  const localDirectoryPath = getLocalDirectoryPath(`customer/${cxId}`);
  return fs.existsSync(path.join(localDirectoryPath, patientId));
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
