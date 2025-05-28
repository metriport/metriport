/**
 * Builds the ID for an OpenSearch entry.
 *
 * @param cxId - The cxId of the resource.
 * @param patientId - The patientId of the resource.
 * @param resourceId - The resourceId of the resource.
 * @returns The ID for the OpenSearch entry.
 */
export function getEntryId(cxId: string, patientId: string, resourceId: string): string {
  return `${cxId}_${patientId}_${resourceId}`;
}
