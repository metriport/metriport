import { Bundle, BundleEntry, Resource } from "@medplum/fhirtypes";
import { getConsolidatedPatientData } from "@metriport/core/command/consolidated/consolidated-get";
import {
  CCD_SUFFIX,
  createUploadFilePath,
  FHIR_BUNDLE_SUFFIX,
} from "@metriport/core/domain/document/upload";
import { Organization } from "@metriport/core/domain/organization";
import { Patient } from "@metriport/core/domain/patient";
import { S3Utils } from "@metriport/core/external/aws/s3";
import { dangerouslyDeduplicate } from "@metriport/core/external/fhir/consolidated/deduplicate";
import { toFHIR as toFhirOrganization } from "@metriport/core/external/fhir/organization/conversion";
import { metriportDataSourceExtension } from "@metriport/core/external/fhir/shared/extensions/metriport";
import { out } from "@metriport/core/util/log";
import { JSON_APP_MIME_TYPE } from "@metriport/core/util/mime";
import { capture } from "@metriport/core/util/notifications";
import { errorToString } from "@metriport/shared";
import { convertFhirToCda } from "../../command/medical/patient/convert-fhir-to-cda";
import { normalizeBundle } from "../../command/medical/patient/data-contribution/shared";
import { bundleSchema } from "../../routes/medical/schemas/fhir";
import { Config } from "../../shared/config";
import { validateFhirEntries } from "../fhir/shared/json-validator";
import { generateEmptyCcd } from "./generate-empty-ccd";

const region = Config.getAWSRegion();
const bucket = Config.getMedicalDocumentsBucketName();
const s3Utils = new S3Utils(region);

export async function generateCcd(
  patient: Patient,
  organization: Organization,
  requestId: string
): Promise<string> {
  const uploadsExist = await s3Utils.fileExists(bucket, {
    targetString: FHIR_BUNDLE_SUFFIX,
    path: createUploadFilePath(patient.cxId, patient.id, ""),
  });
  if (!uploadsExist) {
    return generateEmptyCcd(patient);
  }
  const metriportGenerated = await getFhirResourcesForCcd(patient);
  if (!metriportGenerated || !metriportGenerated.length) {
    return generateEmptyCcd(patient);
  }

  const fhirOrganization = toFhirOrganization(organization);
  const bundle: Bundle = {
    resourceType: "Bundle",
    type: "collection",
    entry: [...metriportGenerated, { resource: fhirOrganization }],
  };
  dangerouslyDeduplicate({
    cxId: patient.cxId,
    patientId: patient.id,
    bundle,
  });
  const normalizedBundle = normalizeBundle(bundle);
  const parsedBundle = bundleSchema.parse(normalizedBundle);
  await uploadCcdFhirDataToS3(patient, parsedBundle, requestId);

  const validatedBundle = validateFhirEntries(parsedBundle);
  const converted = await convertFhirToCda({
    cxId: patient.cxId,
    validatedBundle,
    splitCompositions: false,
  });
  const ccd = converted[0];
  if (!ccd) throw new Error("Failed to create CCD");
  return ccd;
}

async function getFhirResourcesForCcd(
  patient: Patient
): Promise<BundleEntry<Resource>[] | undefined> {
  const allResources = await getConsolidatedPatientData({ patient, forceDataFromFhir: true });
  return allResources.entry?.filter(entry => {
    const resource = entry.resource;
    if (resource?.resourceType === "Composition") return false;

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
}

async function uploadCcdFhirDataToS3(
  patient: Patient,
  data: Bundle,
  requestId: string
): Promise<void> {
  const { log } = out(`Upload FHIR data for CCD cxId: ${patient.cxId}, patientId: ${patient.id}`);
  const key = createUploadFilePath(
    patient.cxId,
    patient.id,
    `${requestId}_${CCD_SUFFIX}_${FHIR_BUNDLE_SUFFIX}.json`
  );
  try {
    await s3Utils.uploadFile({
      bucket,
      key,
      file: Buffer.from(JSON.stringify(data)),
      contentType: JSON_APP_MIME_TYPE,
    });
  } catch (error) {
    const msg = `Error uploading FHIR data for CCD`;
    log(`${msg}: error - ${errorToString(error)}`);
    capture.error(msg, { extra: { cxId: patient.cxId, patientId: patient.id } });
  }
}
