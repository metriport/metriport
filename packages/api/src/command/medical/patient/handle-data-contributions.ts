import { Bundle, Resource } from "@medplum/fhirtypes";
import { createUploadFilePath, FHIR_BUNDLE_SUFFIX } from "@metriport/core/domain/document/upload";
import { Patient } from "@metriport/core/domain/patient";
import { uploadCdaDocuments, uploadFhirBundleToS3 } from "@metriport/core/fhir-to-cda/upload";
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
  const [organization, patient] = await Promise.all([
    getOrganizationOrFail({ cxId }),
    getPatientOrFail({ id: patientId, cxId }),
  ]);

  const fhirOrganization = toFhirOrganization(organization);
  const fhirBundleDestinationKey = createUploadFilePath(
    cxId,
    patientId,
    `${requestId}_${FHIR_BUNDLE_SUFFIX}.json`
  );
  const fullBundle = hydrateBundle(bundle, patient, fhirOrganization, fhirBundleDestinationKey);

  await uploadFhirBundleToS3({
    cxId,
    patientId,
    fhirBundle: fullBundle,
    destinationKey: fhirBundleDestinationKey,
  });

  const validatedBundle = validateFhirEntries(fullBundle);

  const incomingAmount = validatedBundle.entry.length;
  await checkResourceLimit(incomingAmount, patient);

  const consolidatedDataUploadResults = await createOrUpdateConsolidatedPatientData({
    cxId,
    patientId: patient.id,
    fhirBundle: validatedBundle,
  });

  const convertAndUploadCdaPromise = async () => {
    const isValidForCdaConversion = hasCompositionResource(validatedBundle);
    if (isValidForCdaConversion) {
      const converted = await convertFhirToCda({
        cxId,
        validatedBundle,
      });
      await uploadCdaDocuments({
        cxId,
        patientId,
        cdaBundles: converted,
        organization: fhirOrganization,
        docId: requestId,
      });
    }
  };
  const createAndUploadCcdPromise = async () => {
    // TODO: To minimize generating CCDs, make it a delayed job (run it ~5min after it was initiated, only once for all requests within that time window)
    await processCcdRequest(patient, fhirOrganization);
  };

  await Promise.all([createAndUploadCcdPromise(), convertAndUploadCdaPromise()]);
  return consolidatedDataUploadResults;
}

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
