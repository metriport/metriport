import { Bundle } from "@medplum/fhirtypes";
import { metriportDataSourceExtension } from "@metriport/core/external/fhir/shared/extensions/metriport";
import { getOrganizationOrFail } from "../../command/medical/organization/get-organization";
import { getConsolidatedPatientData } from "../../command/medical/patient/consolidated-get";
import { convertFhirToCda } from "../../command/medical/patient/convert-fhir-to-cda";
import { getPatientOrFail } from "../../command/medical/patient/get-patient";
import { bundleSchema } from "../../routes/medical/schemas/fhir";
import { toFHIR as toFhirOrganization } from "../fhir/organization";
import { validateFhirEntries } from "../fhir/shared/json-validator";
import { generateEmptyCcd } from "./generate-empty-ccd";

export async function generateCcd({
  patientId,
  cxId,
}: {
  patientId: string;
  cxId: string;
}): Promise<string | undefined> {
  const [organization, patient] = await Promise.all([
    getOrganizationOrFail({ cxId }),
    getPatientOrFail({ cxId, id: patientId }),
  ]);
  const allResources = await getConsolidatedPatientData({ patient });
  const metriportGenerated = allResources.entry?.filter(entry => {
    const resource = entry.resource;
    if (resource && "extension" in resource) {
      return resource.extension?.some(
        (extension: { valueCoding?: { code?: string } }) =>
          extension.valueCoding?.code === metriportDataSourceExtension.valueCoding.code
      );
    }
    return false;
  });

  if (!metriportGenerated || !metriportGenerated.length) {
    return generateEmptyCcd({ patientId, cxId });
  }

  const fhirOrganization = toFhirOrganization(organization);
  const bundle: Bundle = {
    resourceType: "Bundle",
    type: "collection",
    entry: [...metriportGenerated, { resource: fhirOrganization }],
  };
  const parsedBundle = bundleSchema.parse(bundle);
  const validatedBundle = validateFhirEntries(parsedBundle);

  const cda = await convertFhirToCda({
    cxId,
    validatedBundle,
    toSplit: false,
  });
  return cda[0];
}
