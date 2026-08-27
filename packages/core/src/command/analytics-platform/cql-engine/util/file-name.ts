/**
 * Generate S3 key prefix for a bulk job. This will keep the job ID before the patient ID.
 * Format: care-gaps/cx={customerId}/job={jobId}/pt={patientId}
 */
export function generateBulkJobKeyPrefix({
  customerId,
  jobId,
  patientId,
}: {
  customerId: string;
  jobId: string;
  patientId: string;
}): string {
  return `care-gaps/cx=${customerId}/job=${jobId}/pt=${patientId}`;
}
