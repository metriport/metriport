import { Bundle } from "@medplum/fhirtypes";
import { Patient } from "@metriport/core/domain/patient";
import { metriportDataSourceExtension } from "@metriport/core/external/fhir/shared/extensions/metriport";
import { getOrganizationOrFail } from "../../command/medical/organization/get-organization";
import { getConsolidatedPatientData } from "../../command/medical/patient/consolidated-get";
import { convertFhirToCda } from "../../command/medical/patient/convert-fhir-to-cda";
import { bundleSchema } from "../../routes/medical/schemas/fhir";
import { toFHIR as toFhirOrganization } from "../fhir/organization";
import { validateFhirEntries } from "../fhir/shared/json-validator";
import { generateEmptyCcd } from "./generate-empty-ccd";

export async function generateCcd(patient: Patient): Promise<string> {
  const organization = await getOrganizationOrFail({ cxId: patient.cxId });
  const allResources = await getConsolidatedPatientData({ patient });
  const metriportGenerated = allResources.entry?.filter(entry => {
    const resource = entry.resource;

    if (resource) {
      // All new FHIR data coming from our CX will now have extensions.
      if ("extension" in resource) {
        return resource.extension?.some(
          (extension: { valueCoding?: { code?: string } }) =>
            extension.valueCoding?.code === metriportDataSourceExtension.valueCoding.code
        );
      }
      // We used to not add extensions to CX-contributed resources. So this will allow us to include those.
      // This is taking advantage of how all the resources resulting from external CDAs have extensions.
      if (!("extension" in resource)) {
        return true;
      }
    }

    return false;
  });

  if (!metriportGenerated || !metriportGenerated.length) {
    return generateEmptyCcd(patient);
  }

  const fhirOrganization = toFhirOrganization(organization);
  const bundle: Bundle = {
    resourceType: "Bundle",
    type: "collection",
    entry: [...metriportGenerated, { resource: fhirOrganization }],
  };
  const parsedBundle = bundleSchema.parse(bundle);
  const validatedBundle = validateFhirEntries(parsedBundle);

  const converted = await convertFhirToCda({
    cxId: patient.cxId,
    validatedBundle,
    toSplit: false,
  });
  const ccd = converted[0];
  if (!ccd) throw new Error("Failed to create CCD");
  return ccd;
}
