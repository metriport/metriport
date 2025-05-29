import { Bundle, Resource } from "@medplum/fhirtypes";
import { createUploadFilePath, FHIR_BUNDLE_SUFFIX } from "@metriport/core/domain/document/upload";
import { Patient } from "@metriport/core/domain/patient";
import { toFHIR as toFhirOrganization } from "@metriport/core/external/fhir/organization/conversion";
import { toFHIR as toFhirPatient } from "@metriport/core/external/fhir/patient/conversion";
import { uploadCdaDocuments, uploadFhirBundleToS3 } from "@metriport/core/fhir-to-cda/upload";
import { out } from "@metriport/core/util/log";
import { uuidv7 } from "@metriport/core/util/uuid-v7";
import { processCcdRequest } from "../../../../external/cda/process-ccd-request";
import { hydrateBundle } from "../../../../external/fhir/shared/hydrate-bundle";
import { validateFhirEntries } from "../../../../external/fhir/shared/json-validator";
import { Bundle as ValidBundle } from "../../../../routes/medical/schemas/fhir";
import { Config } from "../../../../shared/config";
import { getOrganizationOrFail } from "../../organization/get-organization";
import { createOrUpdateConsolidatedPatientData } from "../consolidated-create";
import { convertFhirToCda } from "../convert-fhir-to-cda";
import { checkResourceLimit, hasCompositionResource, normalizeBundle } from "./shared";

export async function handleDataContribution({
  requestId = uuidv7(),
  patient,
  cxId,
  bundle,
  enforceUuid = true,
}: {
  requestId: string;
  patient: Patient;
  cxId: string;
  bundle: ValidBundle;
  enforceUuid?: boolean;
}): Promise<Bundle<Resource> | undefined> {
  const patientId = patient.id;
  const { log } = out(`handleDataContribution - cxId ${cxId}, patientId ${patientId}`);
  const fhirBundleDestinationKey = createUploadFilePath(
    cxId,
    patientId,
    `${requestId}_${FHIR_BUNDLE_SUFFIX}.json`
  );
  const mainStartedAt = Date.now();

  const normalizedBundle = normalizeBundle(bundle);
  const fullBundle = hydrateBundle(
    normalizedBundle,
    patient,
    fhirBundleDestinationKey,
    enforceUuid
  );
  const validatedBundle = validateFhirEntries(fullBundle);

  const [, organization] = await Promise.all([
    uploadFhirBundleToS3({
      fhirBundle: bundle,
      destinationKey: fhirBundleDestinationKey,
    }),
    getOrganizationOrFail({ cxId }),
  ]);
  log(`${Date.now() - mainStartedAt}ms to get org and patient, and store on S3`);

  const validationStartedAt = Date.now();
  const fhirOrganization = toFhirOrganization(organization);
  const incomingAmount = validatedBundle.entry.length;
  await checkResourceLimit(incomingAmount, patient);
  log(`${Date.now() - validationStartedAt}ms to hydrate, validate, and check limits`);

  // Do it before storing on the FHIR server since this also validates the bundle
  if (!Config.isSandbox() && hasCompositionResource(validatedBundle)) {
    const cdaConversionStartedAt = Date.now();
    const fhirPatient = toFhirPatient(patient);
    validatedBundle.entry.push({ resource: fhirPatient });
    validatedBundle.entry.push({ resource: fhirOrganization });
    const converted = await convertFhirToCda({ cxId, validatedBundle });
    // intentionally async
    uploadCdaDocuments({
      cxId,
      patientId,
      cdaBundles: converted,
      organization: fhirOrganization,
      docId: requestId,
    }).then(() => log(`${Date.now() - cdaConversionStartedAt}ms to convert to CDA`));
  }

  const storeStartedAt = Date.now();
  const consolidatedDataUploadResults = await createOrUpdateConsolidatedPatientData({
    cxId,
    patientId: patient.id,
    requestId,
    fhirBundle: validatedBundle,
  });
  log(`${Date.now() - storeStartedAt}ms to store on FHIR server and S3`);

  if (!Config.isSandbox()) {
    // intentionally async
    processCcdRequest({ patient, organization, requestId });
  }

  return consolidatedDataUploadResults;
}
