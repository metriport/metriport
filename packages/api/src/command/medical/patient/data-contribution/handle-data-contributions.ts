import { Bundle, Resource } from "@medplum/fhirtypes";
import {
  getFullContributionBundle,
  updateFullConsolidatedBundle,
} from "@metriport/core/command/consolidated/contribution-bundle-create";
import { createContributionBundleFilePath } from "@metriport/core/domain/document/upload";
import { Patient } from "@metriport/core/domain/patient";
import { processBundleUploadTransaction } from "@metriport/core/external/fhir/bundle/transaction-response-bundle";
import { hydrate } from "@metriport/core/external/fhir/consolidated/hydrate";
import { normalize } from "@metriport/core/external/fhir/consolidated/normalize";
import { toFHIR as toFhirOrganization } from "@metriport/core/external/fhir/organization/conversion";
import { toFHIR as toFhirPatient } from "@metriport/core/external/fhir/patient/conversion";
import { uploadCdaDocuments, uploadFhirBundleToS3 } from "@metriport/core/fhir-to-cda/upload";
import { out } from "@metriport/core/util/log";
import { uuidv7 } from "@metriport/core/util/uuid-v7";
import dayjs from "dayjs";
import { processCcdRequest } from "../../../../external/cda/process-ccd-request";
import { processUploadBundle } from "../../../../external/fhir/shared/hydrate-bundle";
import { validateFhirEntries } from "../../../../external/fhir/shared/json-validator";
import { Bundle as ValidBundle } from "../../../../routes/medical/schemas/fhir";
import { Config } from "../../../../shared/config";
import { getOrganizationOrFail } from "../../organization/get-organization";
// import { createOrUpdateConsolidatedPatientDataLegacy } from "../consolidated-create";
import utc from "dayjs/plugin/utc";
import { convertFhirToCda } from "../convert-fhir-to-cda";
import { getPatientOrFail } from "../get-patient";
import {
  checkResourceLimit,
  cleanupSpecialCharsFromBundle,
  hasCompositionResource,
} from "./shared";

dayjs.extend(utc);

type UploadResponse = { bundle: Bundle<Resource> | undefined; status: number };

export async function handleDataContribution({
  cxId,
  patientId,
  requestId = uuidv7(),
  bundle,
}: {
  cxId: string;
  patientId: string;
  requestId: string;
  bundle: ValidBundle;
}): Promise<UploadResponse> {
  const { log } = out(`handleDataContribution - cx ${cxId}, pt ${patientId}`);
  const fhirBundleDestinationKey = createContributionBundleFilePath(cxId, patientId, requestId);
  const mainStartedAt = Date.now();
  const [organization, patient] = await Promise.all([
    getOrganizationOrFail({ cxId }),
    getPatientOrFail({ id: patientId, cxId }),
  ]);
  log(`${Date.now() - mainStartedAt}ms to get org and patient, and store on S3`);

  const validationStartedAt = Date.now();
  const fhirOrganization = toFhirOrganization(organization);
  const cleanBundle = cleanupSpecialCharsFromBundle(bundle);
  const processedUploadBundle = processUploadBundle(cleanBundle, patient, fhirBundleDestinationKey);
  const validatedBundle = validateFhirEntries(processedUploadBundle);
  const hydratedBundle = await hydrate({ cxId, patientId, bundle: validatedBundle });
  const normalizedBundle = await normalize({ cxId, patientId, bundle: hydratedBundle });
  const incomingAmount = normalizedBundle.entry?.length ?? 0;

  // Only affects sandbox and dev env
  await checkResourceLimit(incomingAmount, patient);

  log(`${Date.now() - validationStartedAt}ms to hydrate, validate, and check limits`);

  const responseBundle = await validateUploadAgainstExistingData(patient, normalizedBundle);
  // Do it before storing on the FHIR server since this also validates the bundle
  if (!Config.isSandbox() && hasCompositionResource(normalizedBundle)) {
    const cdaConversionStartedAt = Date.now();
    const fhirPatient = toFhirPatient(patient);
    normalizedBundle.entry?.push({ resource: fhirPatient });
    normalizedBundle.entry?.push({ resource: fhirOrganization });
    const converted = await convertFhirToCda({ cxId, bundle: normalizedBundle });
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
  await uploadFhirBundleToS3({
    fhirBundle: validatedBundle,
    destinationKey: fhirBundleDestinationKey,
  });

  // TODO: Remove after testing ----------
  // await createOrUpdateConsolidatedPatientDataLegacy({
  //   cxId,
  //   patientId: patient.id,
  //   requestId,
  //   fhirBundle: validatedBundle,
  // });
  // -------------------------------------
  log(`${Date.now() - storeStartedAt}ms to store on FHIR server and S3`);

  if (!Config.isSandbox()) {
    // intentionally async
    processCcdRequest({ patient, organization, requestId });
  }

  return responseBundle;
}

export async function validateUploadAgainstExistingData(
  patient: Patient,
  incomingBundle: Bundle<Resource>
): Promise<UploadResponse> {
  const existingBundle = await getFullContributionBundle(patient);
  const transactionResponseBundle = processBundleUploadTransaction(incomingBundle, existingBundle);
  const status = transactionResponseBundle.entry?.some(e => e.response?.status === "400")
    ? 400
    : 200;

  // TODO: Update the FULL_CONTRIBUTION_BUNDLE
  if (status === 200) {
    await updateFullConsolidatedBundle({
      cxId: patient.cxId,
      patientId: patient.id,
      incomingBundle,
      existingBundle,
    });
  }

  return { bundle: transactionResponseBundle, status };
}
