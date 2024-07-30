import { Bundle, BundleEntry, Patient } from "@medplum/fhirtypes";
import { createUploadFilePath } from "@metriport/core/domain/document/upload";
import { uploadFhirBundleToS3 } from "@metriport/core/fhir-to-cda/upload";
import { MetriportError } from "@metriport/core/util/error/metriport-error";
import { out } from "@metriport/core/util/log";
import { errorToString } from "@metriport/shared";
import { makeFhirApi } from "../../../external/fhir/api/api-factory";
import { makeFHIRServerConnector } from "../../../external/fhir/connector/connector-factory";
import { Config } from "../../../shared/config";

const dataContributionDocId = "contribution";
const sentToFhirServerPrefix = "toFhirServer";
const s3BucketName = Config.getMedicalDocumentsBucketName();

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
}): Promise<void> {
  const { log } = out(
    `createOrUpdateConsolidatedPatientData - cxId ${cxId}, patientId ${patientId}, requestId ${requestId}`
  );
  const toFhirServerBundleKey = createUploadFilePath(
    cxId,
    patientId,
    `${requestId}_${sentToFhirServerPrefix}.json`
  );
  const fhirServer = makeFHIRServerConnector();

  try {
    const fhir = makeFhirApi(cxId);

    const patient = await fhir.readResource("Patient", patientId);

    const fhirBundleTransaction = convertCollectionBundleToTransactionBundle({
      patient,
      fhirBundle,
    });

    await uploadFhirBundleToS3({
      fhirBundle: fhirBundleTransaction,
      destinationKey: toFhirServerBundleKey,
    }),
      await fhirServer.upsertBatch({
        cxId,
        patientId,
        requestId,
        documentId: dataContributionDocId,
        payload: JSON.stringify({ s3FileName: toFhirServerBundleKey, s3BucketName }),
        sendResponse: false,
      });
  } catch (error) {
    const errorMsg = errorToString(error);
    const msg = "Error converting and storing fhir bundle resources";
    const additionalInfo = { cxId, patientId, toFhirServerBundleKey };
    log(`${msg}: ${errorMsg}, additionalInfo: ${JSON.stringify(additionalInfo)}`);
    if (errorMsg.includes("ID")) throw new MetriportError(errorMsg, error, additionalInfo);
    throw new MetriportError(msg, error, additionalInfo);
  }
}

const convertCollectionBundleToTransactionBundle = ({
  patient,
  fhirBundle,
}: {
  patient: Patient;
  fhirBundle: Bundle;
}): Bundle => {
  const transactionBundle: Bundle = {
    resourceType: "Bundle",
    type: "transaction",
    entry: [],
  };

  for (const entry of fhirBundle.entry || []) {
    const resource = entry.resource;
    if (!resource) {
      continue;
    }

    if (
      resource.resourceType === "Agent" ||
      resource.resourceType === "AsyncJob" ||
      resource.resourceType === "AccessPolicy" ||
      resource.resourceType === "Binary" ||
      resource.resourceType === "Bot" ||
      resource.resourceType === "BulkDataExport" ||
      resource.resourceType === "Bundle" ||
      resource.resourceType === "ClientApplication" ||
      resource.resourceType === "DomainConfiguration" ||
      resource.resourceType === "JsonWebKey" ||
      resource.resourceType === "Login" ||
      resource.resourceType === "Parameters" ||
      resource.resourceType === "PasswordChangeRequest" ||
      resource.resourceType === "Project" ||
      resource.resourceType === "ProjectMembership" ||
      resource.resourceType === "SmartAppLaunch" ||
      resource.resourceType === "User" ||
      resource.resourceType === "UserConfiguration"
    )
      continue;

    const transactionEntry: BundleEntry = {
      resource,
      request: { method: "PUT", url: resource.resourceType + "/" + resource.id },
    };

    if (resource.resourceType !== "Patient") {
      transactionEntry.resource = {
        ...resource,
        contained: resource.contained ? [...resource.contained, patient] : [patient],
      };
    }

    transactionBundle.entry?.push(transactionEntry);
  }

  return transactionBundle;
};
