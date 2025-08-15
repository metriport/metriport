import { BadRequestError } from "@metriport/shared";
import { athenaSecondaryMappingsSchema } from "@metriport/shared/interface/external/ehr/athenahealth/cx-mapping";
import { EhrSources } from "@metriport/shared/interface/external/ehr/source";
import { getSecondaryMappings } from "../../../api/get-secondary-mappings";
import { WriteBackGroupedVitalsClientRequest } from "../../../command/write-back/grouped-vitals";
import { GroupedVitals } from "../../../shared";
import { createAthenaHealthClient } from "../../shared";

export async function writeBackGroupedVitals(
  params: WriteBackGroupedVitalsClientRequest
): Promise<void> {
  const {
    cxId,
    practiceId,
    ehrPatientId,
    tokenId,
    groupedVitals,
  }: WriteBackGroupedVitalsClientRequest = params;
  const secondaryMappings = await getSecondaryMappings({
    ehr: EhrSources.athena,
    practiceId,
    schema: athenaSecondaryMappingsSchema,
  });
  const athenaDepartmentIds = secondaryMappings.departmentIds;
  if (!athenaDepartmentIds || athenaDepartmentIds.length === 0) {
    throw new BadRequestError("Department IDs not found", undefined, {
      ehr: EhrSources.athena,
      practiceId,
    });
  }

  // Use the first department ID for write-back
  const athenaDepartmentId = athenaDepartmentIds[0];
  if (!athenaDepartmentId) {
    throw new BadRequestError("First department ID not found", undefined, {
      ehr: EhrSources.athena,
      practiceId,
    });
  }

  // Convert GroupedVitalsByDate to GroupedVitals format expected by Athena
  const [, observations] = groupedVitals;
  if (!observations || observations.length === 0) {
    throw new BadRequestError("No vitals observations found", undefined, {
      ehr: EhrSources.athena,
      practiceId,
      ehrPatientId,
    });
  }

  // Use the most recent observation (first in array) as the primary
  const mostRecentObservation = observations[0];
  if (!mostRecentObservation) {
    throw new BadRequestError("No valid vitals observation found", undefined, {
      ehr: EhrSources.athena,
      practiceId,
      ehrPatientId,
    });
  }

  const groupedVitalsForAthena: GroupedVitals = {
    mostRecentObservation,
    sortedPoints: [], // Athena requires this field even if empty
  };

  const client = await createAthenaHealthClient({
    cxId,
    practiceId,
    ...(tokenId && { tokenId }),
  });
  await client.createVitals({
    cxId,
    patientId: ehrPatientId,
    departmentId: athenaDepartmentId,
    vitals: groupedVitalsForAthena,
  });
}
