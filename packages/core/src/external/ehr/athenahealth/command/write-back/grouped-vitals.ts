import { BadRequestError } from "@metriport/shared";
import { athenaSecondaryMappingsSchema } from "@metriport/shared/interface/external/ehr/athenahealth/cx-mapping";
import { EhrSources } from "@metriport/shared/interface/external/ehr/source";
import { getSecondaryMappings } from "../../../api/get-secondary-mappings";
import {
  isGroupedVitalsByCode,
  WriteBackGroupedVitalsClientRequest,
} from "../../../command/write-back/grouped-vitals";
import { createAthenaHealthClient } from "../../shared";

export async function writeBackGroupedVitals(
  params: WriteBackGroupedVitalsClientRequest
): Promise<void> {
  const { cxId, practiceId, ehrPatientId, tokenInfo, groupedVitals } = params;

  if (!isGroupedVitalsByCode(groupedVitals)) {
    throw new BadRequestError("Invalid grouped vitals", undefined, {
      ehr: EhrSources.athena,
      writeBackResource: "grouped-vitals",
    });
  }

  const secondaryMappings = await getSecondaryMappings({
    ehr: EhrSources.athena,
    practiceId,
    schema: athenaSecondaryMappingsSchema,
  });
  const athenaDepartmentId = secondaryMappings.departmentIds[0];
  if (!athenaDepartmentId) {
    throw new BadRequestError("Department ID not found", undefined, {
      ehr: EhrSources.athena,
      practiceId,
    });
  }
  const client = await createAthenaHealthClient({
    cxId,
    practiceId,
    ...(tokenInfo ? { tokenInfo } : {}),
  });
  await client.createVitals({
    cxId,
    patientId: ehrPatientId,
    departmentId: athenaDepartmentId,
    vitals: groupedVitals,
  });
}
