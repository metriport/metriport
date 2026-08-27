import { Bundle } from "@medplum/fhirtypes";
import { NotFoundError } from "@metriport/shared";
import { athenaSecondaryMappingsSchema } from "@metriport/shared/interface/external/ehr/athenahealth/cx-mapping";
import { EhrSources } from "@metriport/shared/interface/external/ehr/source";
import { out } from "../../../../util";
import { getSecondaryMappings } from "../../api/get-secondary-mappings";
import { GetBundleByResourceTypeClientRequest } from "../../command/get-bundle-by-resource-type";
import { createAthenaHealthClient } from "../shared";
import { getAndCheckAthenaPatientDepartmentId } from "./get-and-check-patient-department-id";

export async function getBundleByResourceType(
  params: GetBundleByResourceTypeClientRequest
): Promise<Bundle> {
  const {
    tokenInfo,
    cxId,
    practiceId,
    metriportPatientId,
    ehrPatientId,
    resourceType,
    useCachedBundle,
  } = params;

  const { log } = out(
    `getBundleByResourceType @ AthenaHealth - practiceId: ${practiceId}, ehrPatientId: ${ehrPatientId}, cxId: ${cxId}`
  );

  const client = await createAthenaHealthClient({
    cxId,
    practiceId,
    ...(tokenInfo ? { tokenInfo } : {}),
  });
  const mappings =
    resourceType === "Encounter"
      ? await getSecondaryMappings({
          ehr: EhrSources.athena,
          practiceId,
          schema: athenaSecondaryMappingsSchema,
        })
      : undefined;

  let departmentId: string | undefined;
  try {
    departmentId = await getAndCheckAthenaPatientDepartmentId({
      cxId,
      practiceId,
      patientId: ehrPatientId,
      ...(tokenInfo ? { tokenInfo } : {}),
    });
  } catch (error) {
    if (error instanceof NotFoundError) {
      log(
        "Failed to get patient department ID; Ask CX to assign a 'primarydepartmentid' to patient in order for auto write-back to work"
      );
    } else {
      throw error;
    }
  }

  const bundle = await client.getBundleByResourceType({
    cxId,
    metriportPatientId,
    athenaPatientId: ehrPatientId,
    resourceType,
    useCachedBundle,
    ...(departmentId ? { departmentId } : {}),
    ...(mappings?.contributionEncounterAppointmentTypesBlacklist
      ? {
          attachAppointmentType: true,
        }
      : {}),
    ...(mappings?.contributionEncounterSummariesEnabled
      ? {
          fetchEncounterSummary: true,
        }
      : {}),
  });
  return bundle;
}
