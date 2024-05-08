export function getDocumentReferenceContentTypeCounts(
  docRefsContentTypes: string[]
): Record<string, number> {
  const contentTypeCounts = docRefsContentTypes.reduce((acc, curr) => {
    acc[curr] = (acc[curr] || 0) + 1;

    return acc;
  }, {} as Record<string, number>);

  return contentTypeCounts;
}
