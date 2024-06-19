import { Patient } from "@metriport/core/domain/patient";
import { toFHIR as toFhirPatient } from "@metriport/core/external/fhir/patient/index";
import { createUploadFilePath } from "@metriport/core/domain/document/upload";
import { uploadFhirBundleToS3 } from "@metriport/core/fhir-to-cda/upload";
import { uuidv7 } from "@metriport/core/util/uuid-v7";
import BadRequestError from "../../../errors/bad-request";
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
  patientId,
  cxId,
  bundle,
}: {
  patientId: string;
  cxId: string;
  bundle: ValidBundle;
}) {
  const [organization, patient] = await Promise.all([
    getOrganizationOrFail({ cxId }),
    getPatientOrFail({ id: patientId, cxId }),
  ]);

  const fhirOrganization = toFhirOrganization(organization);
  const fhirPatient = toFhirPatient(patient);
  const docId = uuidv7();
  const fhirBundleDestinationKey = createUploadFilePath(
    cxId,
    patientId,
    `${docId}_FHIR_BUNDLE.json`
  );
  const fullBundle = hydrateBundle(bundle, fhirPatient, fhirOrganization, fhirBundleDestinationKey);
  const validatedBundle = validateFhirEntries(fullBundle);
  const incomingAmount = validatedBundle.entry.length;

  await checkResourceLimit(incomingAmount, patient);
  await uploadFhirBundleToS3({
    cxId,
    patientId,
    fhirBundle: validatedBundle,
    destinationKey: fhirBundleDestinationKey,
  });
  const patientDataPromise = async () => {
    return createOrUpdateConsolidatedPatientData({
      cxId,
      patientId: patient.id,
      fhirBundle: validatedBundle,
    });
  };
  const convertAndUploadCdaPromise = async () => {
    const isValidForCdaConversion = hasCompositionResource(validatedBundle);
    if (isValidForCdaConversion) {
      await convertFhirToCda({
        cxId,
        patientId,
        docId,
        validatedBundle,
      });
    }
  };

  return Promise.all([patientDataPromise(), convertAndUploadCdaPromise()]);
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
