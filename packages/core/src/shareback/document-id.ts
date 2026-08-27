import { createPatientUniqueId, uuidv7 } from "@metriport/shared";
import { createUuidFromText } from "@metriport/shared/common/uuid";
import { CCD_SUFFIX } from "./file";

export function buildDocumentId(cxId: string, patientId: string, isCcd: boolean): string {
  return isCcd ? createCcdDocumentId(cxId, patientId) : createCcdaDocumentId();
}

function createCcdDocumentId(cxId: string, patientId: string): string {
  const encodedPatientId = createPatientUniqueId(cxId, patientId);
  return createUuidFromText(`${encodedPatientId}-${CCD_SUFFIX}`);
}

function createCcdaDocumentId(): string {
  return uuidv7();
}
