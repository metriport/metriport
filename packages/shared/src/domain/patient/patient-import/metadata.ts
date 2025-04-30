/**
 * Used to store metadata on the upload URL.
 */
export type PatientImportUploadMetadata = {
  isDev?: boolean;
};
// keep values lowercase, that's how they are stored in S3
const metaKeys: Record<keyof PatientImportUploadMetadata, string> = {
  isDev: "isdev",
};

export function toS3Metadata(metadata: PatientImportUploadMetadata): Record<string, string> {
  return {
    [metaKeys.isDev]: metadata.isDev ? "true" : "false",
  };
}

export function fromS3Metadata(
  record: Record<string, string> | undefined
): PatientImportUploadMetadata {
  if (!record) return {};
  return {
    ...(record[metaKeys.isDev] ? { isDev: record[metaKeys.isDev] === "true" } : {}),
  };
}
