import { Bundle } from "@medplum/fhirtypes";
import { NotFoundError } from "@metriport/shared";
import { athenaSecondaryMappingsSchema } from "@metriport/shared/interface/external/ehr/athenahealth/cx-mapping";
import { EhrSources } from "@metriport/shared/interface/external/ehr/source";
import { out } from "../../../../util";
import { getSecondaryMappings } from "../../api/get-secondary-mappings";
import { GetResourceBundleByResourceIdClientRequest } from "../../command/get-resource-bundle-by-resource-id";
import { createAthenaHealthClient } from "../shared";
import { getAndCheckAthenaPatientDepartmentId } from "./get-and-check-patient-department-id";

export async function getResourceBundleByResourceId(
  params: GetResourceBundleByResourceIdClientRequest
): Promise<Bundle> {
  const {
    tokenInfo,
    cxId,
    practiceId,
    metriportPatientId,
    ehrPatientId,
    resourceType,
    resourceId,
    useCachedBundle,
  } = params;

  const { log } = out(
    `getResourceBundleByResourceId @ AthenaHealth- practiceId: ${practiceId}, ehrPatientId: ${ehrPatientId}, cxId: ${cxId}`
  );

  const client = await createAthenaHealthClient({
    cxId,
    practiceId,
    ...(tokenInfo && { tokenInfo }),
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
  const bundle = await client.getResourceBundleByResourceId({
    cxId,
    metriportPatientId,
    athenaPatientId: ehrPatientId,
    resourceId,
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
