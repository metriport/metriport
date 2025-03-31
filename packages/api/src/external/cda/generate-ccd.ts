import { Bundle } from "@medplum/fhirtypes";
import { getFullContributionBundle } from "@metriport/core/command/consolidated/contribution-bundle-create";
import {
  CCD_SUFFIX,
  FHIR_BUNDLE_SUFFIX,
  createUploadFilePath,
} from "@metriport/core/domain/document/upload";
import { Organization } from "@metriport/core/domain/organization";
import { Patient } from "@metriport/core/domain/patient";
import { S3Utils } from "@metriport/core/external/aws/s3";
import { toFHIR as toFhirOrganization } from "@metriport/core/external/fhir/organization/conversion";
import { isComposition } from "@metriport/core/external/fhir/shared/index";
import { out } from "@metriport/core/util/log";
import { JSON_APP_MIME_TYPE } from "@metriport/core/util/mime";
import { capture } from "@metriport/core/util/notifications";
import { errorToString } from "@metriport/shared";
import { convertFhirToCda } from "../../command/medical/patient/convert-fhir-to-cda";
import { cleanupSpecialCharsFromBundle } from "../../command/medical/patient/data-contribution/shared";
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
  const uploadPath = createUploadFilePath(patient.cxId, patient.id, "");
  const uploadsExist = await s3Utils.fileExists(bucket, {
    path: uploadPath,
    targetString: FHIR_BUNDLE_SUFFIX,
  });

  console.log("uploadsExist", uploadsExist);
  if (!uploadsExist) {
    return generateEmptyCcd(patient);
  }
  const fullBundle = await getFullContributionBundle(patient);
  console.log("fullBundle", JSON.stringify(fullBundle));
  const validEntries = fullBundle?.entry?.filter(r => !isComposition(r.resource));

  if (!validEntries || !validEntries.length) {
    return generateEmptyCcd(patient);
  }

  const fhirOrganization = toFhirOrganization(organization);
  const bundle: Bundle = {
    resourceType: "Bundle",
    type: "collection",
    entry: [...validEntries, { resource: fhirOrganization }],
  };
  const normalizedBundle = cleanupSpecialCharsFromBundle(bundle);
  const parsedBundle = bundleSchema.parse(normalizedBundle);
  await uploadCcdFhirDataToS3(patient, parsedBundle, requestId);

  const validatedBundle = validateFhirEntries(parsedBundle);
  const converted = await convertFhirToCda({
    cxId: patient.cxId,
    bundle: validatedBundle,
    splitCompositions: false,
  });
  const ccd = converted[0];
  if (!ccd) throw new Error("Failed to create CCD");
  return ccd;
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
