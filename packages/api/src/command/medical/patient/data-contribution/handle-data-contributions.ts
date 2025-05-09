import { Bundle, Resource } from "@medplum/fhirtypes";
import {
  getFullContributionBundle,
  uploadFullContributionBundle,
} from "@metriport/core/command/consolidated/contribution-bundle-create";
import { processBundleUploadTransaction } from "@metriport/core/command/contributed/process-upload-bundle";
import { processBundle } from "@metriport/core/domain/conversion/bundle-modifications/process";
import { createContributionBundleFilePath } from "@metriport/core/domain/document/upload";
import { Patient } from "@metriport/core/domain/patient";
import { toFHIR as toFhirOrganization } from "@metriport/core/external/fhir/organization/conversion";
import { buildBundleEntry } from "@metriport/core/external/fhir/shared/bundle";
import { uploadCdaDocuments, uploadFhirBundleToS3 } from "@metriport/core/fhir-to-cda/upload";
import { out } from "@metriport/core/util/log";
import { uuidv7 } from "@metriport/core/util/uuid-v7";
import { BadRequestError, errorToString } from "@metriport/shared";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import { processCcdRequest } from "../../../../external/cda/process-ccd-request";
import { preprocessAndValidateUploadBundle } from "../../../../external/fhir/shared/hydrate-bundle";
import { OrganizationModel } from "../../../../models/medical/organization";
import { Bundle as ValidBundle } from "../../../../routes/medical/schemas/fhir";
import { Config } from "../../../../shared/config";
import { getOrganizationOrFail } from "../../organization/get-organization";
import { convertFhirToCda } from "../convert-fhir-to-cda";
import { checkResourceLimit, hasCompositionResource } from "./shared";

dayjs.extend(utc);

type UploadResponse = { bundle: Bundle<Resource> | undefined; status: number };

export async function handleDataContribution({
  requestId = uuidv7(),
  patient,
  cxId,
  bundle,
}: {
  requestId: string;
  patient: Patient;
  cxId: string;
  bundle: ValidBundle;
}): Promise<UploadResponse> {
  if (!bundle.entry || bundle.entry.length === 0) {
    throw new BadRequestError(`The bundle is missing entries`);
  }

  const patientId = patient.id;
  const { log } = out(`handleDataContribution - cx ${cxId}, pt ${patientId}`);

  const fhirBundleDestinationKey = createContributionBundleFilePath(cxId, patientId, requestId);
  const organization = await getOrganizationOrFail({ cxId });

  const incomingAmount = bundle.entry?.length ?? 0;
  await checkResourceLimit(incomingAmount, patient); // Only affects sandbox and dev env

  const processingStartedAt = Date.now();
  const validatedBundle = preprocessAndValidateUploadBundle(
    bundle,
    patient,
    fhirBundleDestinationKey
  );
  const processedBundle = await processBundle({
    bundle: validatedBundle,
    cxId,
    patientId,
    options: { deduplicate: false },
  });

  log(`${Date.now() - processingStartedAt}ms to process the incoming bundle`);

  const responseBundle = await validateUploadAgainstExistingData(patient, processedBundle);

  // intentionally async – make sure we catch errors to avoid unhandled rejections
  processCdaBundle(processedBundle, cxId, patientId, requestId, organization).catch(err =>
    out("handleDataContribution").log(`processCdaBundle failed: ${errorToString(err)}`)
  );

  await uploadFhirBundleToS3({
    fhirBundle: validatedBundle,
    destinationKey: fhirBundleDestinationKey,
  });

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
  const { outcomesBundle, mergedBundle } = processBundleUploadTransaction(
    incomingBundle,
    existingBundle
  );
  const status = outcomesBundle.entry?.some(e => e.response?.status === "400") ? 400 : 200;

  if (status === 200 && mergedBundle) {
    await uploadFullContributionBundle({
      cxId: patient.cxId,
      patientId: patient.id,
      contributionBundle: mergedBundle,
    });
  }

  return { bundle: outcomesBundle, status };
}

/**
 * If the bundle contains a composition resource, convert it to CDA and upload it.
 */
async function processCdaBundle(
  bundle: Bundle<Resource>,
  cxId: string,
  patientId: string,
  requestId: string,
  organization: OrganizationModel
) {
  const { log } = out(`processCdaBundle - cx ${cxId}, pt ${patientId}`);
  if (!Config.isSandbox() && hasCompositionResource(bundle)) {
    const fhirOrganization = toFhirOrganization(organization);
    const cdaConversionStartedAt = Date.now();
    const bundleForCda = {
      ...bundle,
      entry: [...(bundle.entry ?? []), buildBundleEntry(fhirOrganization)],
    };

    const converted = await convertFhirToCda({ cxId, bundle: bundleForCda });
    // intentionally async
    uploadCdaDocuments({
      cxId,
      patientId,
      cdaBundles: converted,
      organization: fhirOrganization,
      docId: requestId,
    })
      .then(() => log(`${Date.now() - cdaConversionStartedAt}ms to convert to CDA`))
      .catch(err => log(`Failed to upload CDA documents: ${errorToString(err)}`));
  }
}
