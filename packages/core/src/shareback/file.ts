import { UPLOADS_FOLDER } from "../domain/document/upload";
import { createFolderName } from "../domain/filename";

export function createSharebackFolderName({
  cxId,
  patientId,
}: {
  cxId: string;
  patientId: string;
}) {
  const folderName = createFolderName(cxId, patientId);
  const prefix = `${folderName}/${UPLOADS_FOLDER}`;
  return prefix;
}
