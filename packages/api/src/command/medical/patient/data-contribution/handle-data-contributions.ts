import { Bundle, Resource } from "@medplum/fhirtypes";
import { FHIR_BUNDLE_SUFFIX, createUploadFilePath } from "@metriport/core/domain/document/upload";
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
import {
  createOrUpdateConsolidatedPatientData,
  createOrUpdateConsolidatedPatientDataLegacy,
} from "../consolidated-create";
import { convertFhirToCda } from "../convert-fhir-to-cda";
import { getPatientOrFail } from "../get-patient";
import { checkResourceLimit, hasCompositionResource, normalizeBundle } from "./shared";

export async function handleDataContribution({
  requestId = uuidv7(),
  patientId,
  cxId,
  bundle,
}: {
  requestId: string;
  patientId: string;
  cxId: string;
  bundle: ValidBundle;
}): Promise<Bundle<Resource> | undefined> {
  const { log } = out(`handleDataContribution - cxId ${cxId}, patientId ${patientId}`);
  const fhirBundleDestinationKey = createUploadFilePath(
    cxId,
    patientId,
    `${requestId}_${FHIR_BUNDLE_SUFFIX}.json`
  );
  const mainStartedAt = Date.now();
  const [, organization, patient] = await Promise.all([
    uploadFhirBundleToS3({
      fhirBundle: bundle,
      destinationKey: fhirBundleDestinationKey,
    }),
    getOrganizationOrFail({ cxId }),
    getPatientOrFail({ id: patientId, cxId }),
  ]);
  log(`${Date.now() - mainStartedAt}ms to get org and patient, and store on S3`);

  const validationStartedAt = Date.now();
  const fhirOrganization = toFhirOrganization(organization);
  const normalizedBundle = normalizeBundle(bundle);
  const fullBundle = hydrateBundle(normalizedBundle, patient, fhirBundleDestinationKey);
  const validatedBundle = validateFhirEntries(fullBundle);
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

  // TODO: Remove after testing ----------
  await createOrUpdateConsolidatedPatientDataLegacy({
    cxId,
    patientId: patient.id,
    requestId,
    fhirBundle: validatedBundle,
  });
  // -------------------------------------
  log(`${Date.now() - storeStartedAt}ms to store on FHIR server and S3`);

  if (!Config.isSandbox()) {
    // intentionally async
    processCcdRequest({ patient, organization, requestId });
  }

  return consolidatedDataUploadResults;
}
