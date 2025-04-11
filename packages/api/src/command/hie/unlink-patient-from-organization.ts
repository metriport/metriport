import { getDocuments } from "@metriport/core/external/fhir/document/get-documents";
import { out } from "@metriport/core/util/log";
import { MetriportError } from "@metriport/shared";
import { S3Utils } from "@metriport/core/external/aws/s3";
import { addOidPrefix } from "@metriport/core/domain/oid";
import { getMetriportContent } from "@metriport/core/external/fhir/shared/extensions/metriport";
import { createMRSummaryFileNameWithSuffix } from "@metriport/core/domain/medical-record-summary";
import { getPatientOrFail } from "../medical/patient/get-patient";
import {
  createConsolidatedSnapshotFileNameWithSuffix,
  createConsolidatedDataFileNameWithSuffix,
} from "@metriport/core/domain/consolidated/filename";
import { makeSearchServiceRemover } from "@metriport/core/external/opensearch/file-search-connector-factory";
import { capture } from "@metriport/core/util";
import { createOrUpdateInvalidLinks } from "../medical/invalid-links/create-invalid-links";
import { updateCQPatientData } from "../../external/carequality/command/cq-patient-data/update-cq-data";
import { updateCwPatientData } from "../../external/commonwell/command/cw-patient-data/update-cw-data";
import { getCWAccessForPatient } from "../../external/commonwell/admin/shared";
import { errorToString, getEnvVarOrFail } from "@metriport/shared";
import { DocumentReferenceWithId } from "@metriport/core/external/fhir/document/document-reference";
import { isOrganization, isPatient } from "@metriport/core/external/fhir/shared/index";
import { hasCommonwellExtension } from "@metriport/core/external/commonwell/extension";
import { hasCarequalityExtension } from "@metriport/core/external/carequality/extension";
import { getCQPatientData } from "../../external/carequality/command/cq-patient-data/get-cq-data";
import { getCwPatientData } from "../../external/commonwell/command/cw-patient-data/get-cw-data";
import { CQData } from "../../external/carequality/cq-patient-data";
import { CwData } from "../../external/commonwell/cw-patient-data";
import { CwLink } from "../../external/commonwell/cw-patient-data";
import { CQLink } from "../../external/carequality/cq-patient-data";
import { Config } from "../../shared/config";
import { makeFhirApi } from "../../external/fhir/api/api-factory";
import { NetworkLink } from "@metriport/commonwell-sdk/models/link";

const s3Utils = new S3Utils(Config.getAWSRegion());
const s3ConversionResultBucketName = getEnvVarOrFail("CONVERSION_RESULT_BUCKET_NAME");
const s3MedicalDocumentsBucketName = getEnvVarOrFail("MEDICAL_DOCUMENTS_BUCKET_NAME");

type UnlinkPatientFromOrganizationParams = {
  cxId: string;
  patientId: string;
  oid: string;
  dryRun?: boolean;
};

function getDryRunPrefix(dryRun?: boolean) {
  return dryRun ? "[DRY RUN] " : "";
}

export async function unlinkPatientFromOrganization({
  cxId,
  patientId,
  oid,
  dryRun = false,
}: UnlinkPatientFromOrganizationParams): Promise<void> {
  const dryRunMsg = getDryRunPrefix(dryRun);
  const { log } = out(
    `${dryRunMsg}unlinkPatientFromOrganization - patient ${patientId} - cxId ${cxId}`
  );
  log(`Unlinking patient from organization ${oid}`);

  const documents = await getDocuments({ cxId, patientId });

  if (documents.length === 0) {
    log(`No documents found for patient ${patientId}`);
    return;
  }

  const documentsWithOid = getDocumentsWithOid(documents, oid);

  if (documentsWithOid.length === 0) {
    log(`No documents found for patient ${patientId} with oid ${oid}`);
    return;
  }

  log(`Found ${documentsWithOid.length} documents to process`);

  const [cqPatientData, cwPatientData] = await Promise.all([
    getCQPatientData({ id: patientId, cxId }),
    getCwPatientData({ id: patientId, cxId }),
  ]);

  const cwLink = findCwLinkWithOid(cwPatientData?.data, oid);
  const cqLink = findCqLinkWithOid(cqPatientData?.data, oid);

  await findAndInvalidateLinks(cwLink, cqLink, cxId, patientId, dryRun, log);

  const errors: { documentId: string; error: unknown }[] = [];

  for (const document of documentsWithOid) {
    const fileName = getS3FileNameFromDocument(document, log);
    if (!fileName) {
      log(`Skipping document ${document.id} - no filename found`);
      continue;
    }

    try {
      log(`Processing document ${document.id}`);
      await Promise.all([
        findAndRemoveConversionResultsFromS3(fileName, dryRun, log),
        findAndRemoveMedicalDocumentFromS3(fileName, dryRun, log),
        findAndRemoveConsolidatedDocumentFromS3(cxId, patientId, dryRun, log),
        deleteFromOpenSearch(document.id, dryRun, log),
      ]);

      // Only delete FHIR resource if all other operations succeeded
      await deleteFhirResource(cxId, document.id, dryRun, log);
      log(`Successfully processed document ${document.id}`);
    } catch (error) {
      log(`Failed to process document ${document.id}: ${errorToString(error)}`);
      errors.push({ documentId: document.id, error });
      continue;
    }
  }

  if (errors.length > 0) {
    capture.error("Failed to process some documents during unlink", {
      extra: { cxId, patientId, oid, errors },
    });
  }

  log(`Completed unlinking patient from organization`);
}

function findCwLinkWithOid(cwPatientData: CwData | undefined, oid: string): CwLink | undefined {
  if (!cwPatientData) return undefined;

  const cwLinks = cwPatientData.links;

  for (const cwLink of cwLinks) {
    const patient = cwLink.patient;
    if (!patient) continue;

    if (patient.identifier?.some(identifier => identifier.system === addOidPrefix(oid))) {
      return cwLink;
    }
  }

  return undefined;
}

function findCqLinkWithOid(cqPatientData: CQData | undefined, oid: string): CQLink | undefined {
  if (!cqPatientData) return undefined;

  const cqLinks = cqPatientData.links;

  return cqLinks.find(link => link.oid === oid);
}

function getDocumentsWithOid(
  documents: DocumentReferenceWithId[],
  oid: string
): DocumentReferenceWithId[] {
  const urnOid = addOidPrefix(oid);
  const commonwellDocuments = documents.filter(hasCommonwellExtension);
  const carequalityDocuments = documents.filter(hasCarequalityExtension);

  const matchingDocumentRefs = [];

  for (const document of commonwellDocuments) {
    const patient = document.contained?.find(isPatient);
    if (!patient) continue;

    const identifier = patient.identifier?.find(identifier => identifier.system === urnOid);
    if (identifier) {
      matchingDocumentRefs.push(document);
    }
  }

  for (const document of carequalityDocuments) {
    const organization = document.contained?.find(isOrganization);
    if (!organization) continue;

    const identifier = organization.identifier?.find(identifier => identifier.value === oid);

    if (identifier) {
      matchingDocumentRefs.push(document);
    }
  }

  return matchingDocumentRefs;
}

function getS3FileNameFromDocument(
  document: DocumentReferenceWithId,
  log: typeof console.log
): string | undefined {
  const s3Attachment = getMetriportContent(document)?.attachment;
  const fileName = s3Attachment?.title;

  if (!fileName) {
    log(`No file name found in document ${document.id}`);
    return undefined;
  }

  return fileName;
}

async function findAndRemoveConversionResultsFromS3(
  fileName: string,
  dryRun = false,
  log: typeof console.log
): Promise<void> {
  const dryRunMsg = getDryRunPrefix(dryRun);
  try {
    const objects = await s3Utils.listObjects(s3ConversionResultBucketName, fileName);
    if (!objects) return;

    const validFiles = objects.flatMap(obj => obj.Key ?? []);
    if (validFiles.length === 0) return;

    log(`${dryRunMsg}Deleting ${validFiles.length} files from S3 for ${fileName}`);

    if (!dryRun) {
      await s3Utils.deleteFiles({
        bucket: s3ConversionResultBucketName,
        keys: validFiles,
      });
    }
  } catch (error) {
    log(`Error removing conversion results from S3: ${errorToString(error)}`);
    throw error;
  }

  log(`Successfully removed conversion results from S3 for ${fileName}`);
}

async function findAndRemoveMedicalDocumentFromS3(
  fileName: string,
  dryRun = false,
  log: typeof console.log
): Promise<void> {
  const dryRunMsg = getDryRunPrefix(dryRun);
  try {
    const documentExists = await s3Utils.fileExists(s3MedicalDocumentsBucketName, fileName);

    if (!documentExists) return;

    log(`${dryRunMsg}Deleting file ${fileName} from S3`);
    if (!dryRun) {
      await s3Utils.deleteFile({ bucket: s3MedicalDocumentsBucketName, key: fileName });
    }
  } catch (error) {
    log(`Error removing medical document from S3: ${errorToString(error)}`);
    throw error;
  }

  log(`Successfully removed medical document from S3 for ${fileName}`);
}

async function findAndRemoveConsolidatedDocumentFromS3(
  cxId: string,
  patientId: string,
  dryRun = false,
  log: typeof console.log
): Promise<void> {
  const dryRunMsg = getDryRunPrefix(dryRun);
  try {
    const consolidatedSnapshotPrefix = createConsolidatedSnapshotFileNameWithSuffix(
      cxId,
      patientId
    );
    const medicalRecordsPrefix = createMRSummaryFileNameWithSuffix(cxId, patientId);
    const consolidatedDataPrefix = createConsolidatedDataFileNameWithSuffix(cxId, patientId);

    const [existingConsolidatedFiles, existingMedicalRecordsFiles, existingConsolidatedDataFiles] =
      await Promise.all([
        s3Utils.listObjects(s3MedicalDocumentsBucketName, consolidatedSnapshotPrefix),
        s3Utils.listObjects(s3MedicalDocumentsBucketName, medicalRecordsPrefix),
        s3Utils.listObjects(s3MedicalDocumentsBucketName, consolidatedDataPrefix),
      ]);

    const existingFilenames: string[] = [];

    if (existingConsolidatedFiles) {
      const consolidatedFileNames = existingConsolidatedFiles.flatMap(file => file.Key ?? []);
      existingFilenames.push(...consolidatedFileNames);
    }

    if (existingMedicalRecordsFiles) {
      const medicalRecordsFileNames = existingMedicalRecordsFiles.flatMap(file => file.Key ?? []);
      existingFilenames.push(...medicalRecordsFileNames);
    }

    if (existingConsolidatedDataFiles) {
      const consolidatedDataFileNames = existingConsolidatedDataFiles.flatMap(
        file => file.Key ?? []
      );
      existingFilenames.push(...consolidatedDataFileNames);
    }

    if (existingFilenames.length > 0) {
      log(`${dryRunMsg}Deleting ${existingFilenames.length} files from S3`);

      if (!dryRun) {
        await s3Utils.deleteFiles({
          bucket: s3MedicalDocumentsBucketName,
          keys: existingFilenames,
        });
      }
    }
  } catch (error) {
    log(`Error removing consolidated documents from S3: ${errorToString(error)}`);
    throw error;
  }

  log(`Successfully removed consolidated documents from S3 for ${cxId} and ${patientId}`);
}

async function findAndInvalidateLinks(
  cwLink: CwLink | undefined,
  cqLink: CQLink | undefined,
  cxId: string,
  patientId: string,
  dryRun = false,
  log: typeof console.log
): Promise<void> {
  const dryRunMsg = getDryRunPrefix(dryRun);
  try {
    const invalidLinks = {
      carequality: cqLink ? [cqLink] : [],
      commonwell: cwLink ? [cwLink] : [],
    };

    if (dryRun) {
      log(`${dryRunMsg}Would invalidate links:`, invalidLinks);
      return;
    }

    const patient = await getPatientOrFail({ cxId, id: patientId });
    const cwAccess = await getCWAccessForPatient(patient);
    if (cwAccess.error != null) throw new MetriportError(cwAccess.error);
    const { commonWell, queryMeta } = cwAccess;

    const downgradeRequests: Promise<NetworkLink>[] = [];
    for (const link of invalidLinks.commonwell) {
      if (!link._links?.downgrade?.href) continue;
      const downgradeRequest = commonWell
        .upgradeOrDowngradeNetworkLink(queryMeta, link._links.downgrade.href)
        .catch(error => {
          const msg = `Failed to downgrade link`;
          log(`${msg}. Cause: ${errorToString(error)}`);
          capture.error(msg, {
            extra: {
              patientId,
              cxId,
              cwReference: commonWell.lastReferenceHeader,
              error,
            },
          });
          throw error;
        });
      downgradeRequests.push(downgradeRequest);
    }

    await Promise.all([
      createOrUpdateInvalidLinks({ id: patientId, cxId, invalidLinks }),
      updateCQPatientData({ id: patientId, cxId, cqLinksToInvalidate: invalidLinks.carequality }),
      updateCwPatientData({ id: patientId, cxId, cwLinksToInvalidate: invalidLinks.commonwell }),
      ...downgradeRequests,
    ]);
  } catch (error) {
    log(`Error invalidating links: ${errorToString(error)}`);
    throw error;
  }
}

async function deleteFromOpenSearch(entryId: string, dryRun = false, log: typeof console.log) {
  const dryRunMsg = getDryRunPrefix(dryRun);
  const openSearch = makeSearchServiceRemover();
  try {
    if (!dryRun) {
      await openSearch.remove(entryId);
    } else {
      log(`${dryRunMsg}Would delete entry ${entryId} from OpenSearch`);
    }
  } catch (error) {
    log(`Error deleting from OpenSearch: ${errorToString(error)}`);
    throw error;
  }

  log(`Successfully deleted entry ${entryId} from OpenSearch`);
}

async function deleteFhirResource(
  cxId: string,
  resourceId: string,
  dryRun = false,
  log: typeof console.log
) {
  const dryRunMsg = getDryRunPrefix(dryRun);
  try {
    if (!dryRun) {
      const fhir = makeFhirApi(cxId);
      await fhir.deleteResource("DocumentReference", resourceId);
    } else {
      log(`${dryRunMsg}Would delete FHIR resource ${resourceId}`);
    }
  } catch (error) {
    log(`Error deleting FHIR resource: ${errorToString(error)}`);
    throw error;
  }
}
