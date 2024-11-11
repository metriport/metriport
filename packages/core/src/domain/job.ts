export function createJobId(requestId: string, documentId: string): string {
  return `${requestId}_${documentId}`;
}

export function parseJobId(
  jobId?: string
): { requestId: string | undefined; documentId: string | undefined } | undefined {
  if (!jobId) return undefined;
  const [requestId, documentId] = jobId.split("_");
  return { requestId, documentId };
}
