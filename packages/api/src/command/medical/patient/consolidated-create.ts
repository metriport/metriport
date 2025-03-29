import { Bundle, BundleEntry } from "@medplum/fhirtypes";
import { createUploadFilePath } from "@metriport/core/domain/document/upload";
import { convertCollectionBundleToTransactionBundle } from "@metriport/core/external/fhir/bundle/convert-to-transaction-bundle";
import { OPERATION_OUTCOME_EXTENSION_URL } from "@metriport/core/external/fhir/shared/extensions/extension";
import { uploadFhirBundleToS3 } from "@metriport/core/fhir-to-cda/upload";
import { MetriportError } from "@metriport/core/util/error/metriport-error";
import { out } from "@metriport/core/util/log";
import { errorToString } from "@metriport/shared";
import { makeFhirApi } from "../../../external/fhir/api/api-factory";

export const sentToFhirServerPrefix = "toFhirServer";

export function createDataContributionBundleName(
  cxId: string,
  patientId: string,
  requestId: string
) {
  return createUploadFilePath(cxId, patientId, `${requestId}_${sentToFhirServerPrefix}.json`);
}

export async function createOrUpdateConsolidatedPatientData({
  cxId,
  patientId,
  requestId,
  fhirBundle,
}: {
  cxId: string;
  patientId: string;
  requestId: string;
  fhirBundle: Bundle;
}): Promise<Bundle | undefined> {
  const { log } = out(
    `createOrUpdateConsolidatedPatientData - cxId ${cxId}, patientId ${patientId}, requestId ${requestId}`
  );
  const toFhirServerBundleKey = createUploadFilePath(
    cxId,
    patientId,
    `${requestId}_${sentToFhirServerPrefix}.json`
  );

  try {
    const fhirBundleTransaction = convertCollectionBundleToTransactionBundle({
      fhirBundle,
    });

    await uploadFhirBundleToS3({
      fhirBundle: fhirBundleTransaction,
      destinationKey: toFhirServerBundleKey,
    });

    console.log("fhirBundleTransaction thru new route is", JSON.stringify(fhirBundleTransaction));
    const transformedBundle = removeUnwantedFhirData(fhirBundleTransaction);

    return transformedBundle;
  } catch (error) {
    const errorMsg = errorToString(error);
    const msg = "Error converting and storing fhir bundle resources";
    const additionalInfo = { cxId, patientId, toFhirServerBundleKey };
    log(`${msg}: ${errorMsg}, additionalInfo: ${JSON.stringify(additionalInfo)}`);
    if (errorMsg.includes("ID")) throw new MetriportError(errorMsg, error, additionalInfo);
    throw new MetriportError(msg, error, additionalInfo);
  }
}

// TODO: Remove after testing -----
export async function createOrUpdateConsolidatedPatientDataLegacy({
  cxId,
  patientId,
  requestId,
  fhirBundle,
}: {
  cxId: string;
  patientId: string;
  requestId: string;
  fhirBundle: Bundle;
}): Promise<Bundle | undefined> {
  const { log } = out(
    `createOrUpdateConsolidatedPatientData - cxId ${cxId}, patientId ${patientId}, requestId ${requestId}`
  );
  const toFhirServerBundleKey = createUploadFilePath(
    cxId,
    patientId,
    `${requestId}_${sentToFhirServerPrefix}.json`
  );
  // --------------------------------

  try {
    const fhir = makeFhirApi(cxId);

    const fhirBundleTransaction = convertCollectionBundleToTransactionBundle({
      fhirBundle,
    });

    const [bundleResource] = await Promise.all([
      fhir.executeBatch(fhirBundleTransaction),
      uploadFhirBundleToS3({
        fhirBundle: fhirBundleTransaction,
        destinationKey: toFhirServerBundleKey,
      }),
    ]);
    console.log("bundleResource thru legacy route is", JSON.stringify(bundleResource));
    const transformedBundle = removeUnwantedFhirData(bundleResource);

    return transformedBundle;
  } catch (error) {
    const errorMsg = errorToString(error);
    const msg = "Error converting and storing fhir bundle resources";
    const additionalInfo = { cxId, patientId, toFhirServerBundleKey };
    log(`${msg}: ${errorMsg}, additionalInfo: ${JSON.stringify(additionalInfo)}`);
    if (errorMsg.includes("ID")) throw new MetriportError(errorMsg, error, additionalInfo);
    throw new MetriportError(msg, error, additionalInfo);
  }
}

const removeUnwantedFhirData = (data: Bundle): Bundle => {
  return {
    resourceType: data.resourceType,
    id: data.id,
    type: data.type,
    entry: data.entry?.map(replaceCodingSystem),
  };
};

const replaceCodingSystem = (resourceEntry: BundleEntry): BundleEntry => {
  return {
    response: {
      ...resourceEntry.response,
      ...(resourceEntry.response?.outcome
        ? {
            outcome: {
              ...resourceEntry.response.outcome,
              issue: resourceEntry.response.outcome.issue?.map(issue => {
                return {
                  ...issue,
                  details: {
                    ...issue.details,
                    coding: issue.details?.coding?.map(coding => {
                      return {
                        ...coding,
                        system: OPERATION_OUTCOME_EXTENSION_URL,
                      };
                    }),
                  },
                };
              }),
            },
          }
        : {}),
    },
  };
};
