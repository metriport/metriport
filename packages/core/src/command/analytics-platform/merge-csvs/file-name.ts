export function buildMergeCsvsBasePrefix(cxId: string): string {
  return `snowflake/merged/cx=${cxId}`;
}

export function buildMergeCsvsJobPrefix({ cxId, jobId }: { cxId: string; jobId: string }): string {
  return `${buildMergeCsvsBasePrefix(cxId)}/merge=${jobId}`;
}

export function buildMergeInfoPrefix({ cxId, jobId }: { cxId: string; jobId: string }): string {
  return `${buildMergeCsvsJobPrefix({ cxId, jobId })}/_info`;
}

export function buildMergeCsvsFileGroupKey(
  fileGroup: { tableName: string; groupId: string },
  params: {
    cxId: string;
    mergeCsvJobId: string;
    mergeCsvRunId: string;
  }
): string {
  const { cxId, mergeCsvJobId, mergeCsvRunId } = params;
  const mergePrefix = buildMergeCsvsJobPrefix({ cxId, jobId: mergeCsvJobId });
  return `${mergePrefix}/${fileGroup.tableName}/run=${mergeCsvRunId}/${fileGroup.groupId}.csv.gz`;
}
