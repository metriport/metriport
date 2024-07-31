import { Bundle, Resource } from "@medplum/fhirtypes";
import { createUploadFilePath, FHIR_BUNDLE_SUFFIX } from "@metriport/core/domain/document/upload";
import { Patient } from "@metriport/core/domain/patient";
import { uploadCdaDocuments, uploadFhirBundleToS3 } from "@metriport/core/fhir-to-cda/upload";
import { out } from "@metriport/core/util/log";
import { uuidv7 } from "@metriport/core/util/uuid-v7";
import BadRequestError from "../../../errors/bad-request";
import { processCcdRequest } from "../../../external/cda/process-ccd-request";
import { toFHIR as toFhirOrganization } from "../../../external/fhir/organization";
import { countResources } from "../../../external/fhir/patient/count-resources";
import { hydrateBundle } from "../../../external/fhir/shared/hydrate-bundle";
import { validateFhirEntries } from "../../../external/fhir/shared/json-validator";
import { Bundle as ValidBundle } from "../../../routes/medical/schemas/fhir";
import { Config } from "../../../shared/config";
import { getOrganizationOrFail } from "../organization/get-organization";
import { createOrUpdateConsolidatedPatientData } from "./consolidated-create";
import { convertFhirToCda } from "./convert-fhir-to-cda";
import { getPatientOrFail } from "./get-patient";

const MAX_RESOURCE_COUNT_PER_REQUEST = 50;
const MAX_RESOURCE_STORED_LIMIT = 1000;

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
  let startedAt = Date.now();
  const [, organization, patient] = await Promise.all([
    uploadFhirBundleToS3({
      fhirBundle: bundle,
      destinationKey: fhirBundleDestinationKey,
    }),
    getOrganizationOrFail({ cxId }),
    getPatientOrFail({ id: patientId, cxId }),
  ]);
  log(`${Date.now() - startedAt}ms to get org and patient, and store on S3`);
  startedAt = Date.now();

  const fhirOrganization = toFhirOrganization(organization);
  const fullBundle = hydrateBundle(bundle, patient, fhirBundleDestinationKey);
  const validatedBundle = validateFhirEntries(fullBundle);
  const incomingAmount = validatedBundle.entry.length;
  await checkResourceLimit(incomingAmount, patient);
  log(`${Date.now() - startedAt}ms to validate and check limits`);
  startedAt = Date.now();

  // Do it before storing on the FHIR server since this also validates the bundle
  if (!Config.isSandbox() && hasCompositionResource(validatedBundle)) {
    const converted = await convertFhirToCda({ cxId, validatedBundle });
    // intentionally async
    uploadCdaDocuments({
      cxId,
      patientId,
      cdaBundles: converted,
      organization: fhirOrganization,
      docId: requestId,
    });
    log(`${Date.now() - startedAt}ms to convert to CDA`);
    startedAt = Date.now();
  }

  const consolidatedDataUploadResults = await createOrUpdateConsolidatedPatientData({
    cxId,
    patientId: patient.id,
    requestId,
    fhirBundle: validatedBundle,
  });
  log(`${Date.now() - startedAt}ms to store on FHIR server and S3`);

  if (!Config.isSandbox()) {
    // intentionally async
    processCcdRequest(patient, fhirOrganization, requestId);
  }

  return consolidatedDataUploadResults;
}

/**
 * SANDBOX ONLY. Checks if the incoming amount of resources, plus what's already stored, exceeds the limit.
 */
async function checkResourceLimit(incomingAmount: number, patient: Patient) {
  if (!Config.isCloudEnv() || Config.isSandbox()) {
    const { total: currentAmount } = await countResources({
      patient: { id: patient.id, cxId: patient.cxId },
    });
    if (currentAmount + incomingAmount > MAX_RESOURCE_STORED_LIMIT) {
      throw new BadRequestError(
        `Reached maximum number of resources per patient in Sandbox mode.`,
        null,
        { currentAmount, incomingAmount, MAX_RESOURCE_STORED_LIMIT }
      );
    }
    // Limit the amount of resources that can be created at once
    if (incomingAmount > MAX_RESOURCE_COUNT_PER_REQUEST) {
      throw new BadRequestError(`Cannot create this many resources at a time.`, null, {
        incomingAmount,
        MAX_RESOURCE_COUNT_PER_REQUEST,
      });
    }
  }
}

function hasCompositionResource(bundle: ValidBundle): boolean {
  return bundle.entry.some(entry => entry.resource?.resourceType === "Composition");
}
