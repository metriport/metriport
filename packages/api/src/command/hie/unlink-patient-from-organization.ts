import { getDocuments } from "@metriport/core/external/fhir/document/get-documents";
import { out } from "@metriport/core/util/log";
import { S3Utils } from "@metriport/core/external/aws/s3";
import {
  buildDocumentNameForPartialConversions,
  buildDocumentNameForConversionResult,
  buildDocumentNameForNormalizedConversion,
  buildDocumentNameForPreConversion,
  buildDocumentNameForCleanConversion,
  buildDocumentNameForFromConverter,
} from "@metriport/core/domain/conversion/filename";
import { addOidPrefix } from "@metriport/core/domain/oid";
import { createFolderName } from "@metriport/core/domain/filename";
import { makeSearchServiceRemover } from "@metriport/core/external/opensearch/file-search-connector-factory";
import { capture } from "@metriport/core/util";
import { createOrUpdateInvalidLinks } from "../medical/invalid-links/create-invalid-links";
import { updateCQPatientData } from "../../external/carequality/command/cq-patient-data/update-cq-data";
import { updateCwPatientData } from "../../external/commonwell/command/cw-patient-data/update-cw-data";
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
  const { log } = out(`${dryRunMsg}unlinkPatientFromOrganization - patient ${patientId}`);
  log(`Unlinking patient from organization ${oid}`);

  const cqPatientData = await getCQPatientData({ id: patientId, cxId });
  const cwPatientData = await getCwPatientData({ id: patientId, cxId });

  const cwLink = findCwLinkWithOid(cwPatientData?.data, oid);
  const cqLink = findCqLinkWithOid(cqPatientData?.data, oid);

  const documents = await getDocuments({ cxId, patientId });

  const documentsWithOid = getDocumentsWithOid(documents, oid);

  log(`Found ${documentsWithOid.length} documents to process`);

  for (const document of documentsWithOid) {
    const fileName = getS3FileNameFromDocument(document);
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
        findAndInvalidateLinks(cwLink, cqLink, cxId, patientId, dryRun, log),
        deleteFromOpenSearch(document.id, dryRun, log),
      ]);

      // Only delete FHIR resource if all other operations succeeded
      await deleteFhirResource(cxId, document.id, dryRun, log);
      log(`Successfully processed document ${document.id}`);
    } catch (error) {
      const msg = `Failed to process document`;
      log(`${msg} ${document.id}: ${errorToString(error)}`);
      capture.error(msg, { extra: { error, documentId: document.id } });
      continue;
    }
  }

  log(`Completed unlinking patient from organization`);
}

function findCwLinkWithOid(cwPatientData: CwData | undefined, oid: string): CwLink | undefined {
  if (!cwPatientData) return undefined;

  const cwLinks = cwPatientData.links;

  for (const cwLink of cwLinks) {
    const patient = cwLink.patient;
    if (!patient) continue;

    const identifier = patient.identifier?.find(
      identifier => identifier.system === addOidPrefix(oid)
    );

    if (identifier) {
      return cwLink;
    }
  }

  return undefined;
}

function findCqLinkWithOid(cqPatientData: CQData | undefined, oid: string): CQLink | undefined {
  if (!cqPatientData) return undefined;

  const cqLinks = cqPatientData.links;

  for (const cqLink of cqLinks) {
    if (cqLink.oid === oid) {
      return cqLink;
    }
  }

  return undefined;
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

function getS3FileNameFromDocument(document: DocumentReferenceWithId): string | undefined {
  const s3Attachment = document.content?.find(content => content.attachment?.url)?.attachment;
  const fileName = s3Attachment?.title;

  if (!fileName) {
    console.error(`No file name found in document ${document.id}`);
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
    const conversionResultFileName = buildDocumentNameForConversionResult(fileName);
    const normalizedFileName = buildDocumentNameForNormalizedConversion(fileName);
    const cleanFileName = buildDocumentNameForCleanConversion(fileName);
    const fromConverterFileName = buildDocumentNameForFromConverter(fileName);
    const preConversionFileName = buildDocumentNameForPreConversion(fileName);

    const fileNames = [
      conversionResultFileName,
      normalizedFileName,
      cleanFileName,
      fromConverterFileName,
      preConversionFileName,
    ];

    const partialConversionFileNames = await getPartialConversionFileNames(preConversionFileName);
    const allFileNames = [...fileNames, ...partialConversionFileNames];

    const existingFiles = await Promise.all(
      allFileNames.map(async fileName => {
        try {
          const exists = await s3Utils.fileExists(s3ConversionResultBucketName, fileName);
          return exists ? fileName : undefined;
        } catch (err) {
          return undefined;
        }
      })
    );

    const validFiles = existingFiles.filter(fileName => fileName !== undefined) as string[];

    for (const fileName of validFiles) {
      log(`${dryRunMsg}Deleting file ${fileName} from S3`);
      if (!dryRun) {
        await s3Utils.deleteFile({ bucket: s3ConversionResultBucketName, key: fileName });
      }
    }
  } catch (error) {
    log("Error removing conversion results from S3:", errorToString(error));
    throw error;
  }
}

async function getPartialConversionFileNames(preConversionFileName: string): Promise<string[]> {
  const partialConversionFileNames: string[] = [];
  let index = 0;
  let partialExists = true;
  while (partialExists) {
    const partialFileName = buildDocumentNameForPartialConversions(preConversionFileName, index);
    try {
      partialExists = await s3Utils.fileExists(s3ConversionResultBucketName, partialFileName);
      if (partialExists) {
        partialConversionFileNames.push(partialFileName);
      }
    } catch (err) {
      partialExists = false;
    }
    index++;
  }
  return partialConversionFileNames;
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
    log("Error removing medical document from S3:", errorToString(error));
    throw error;
  }
}

async function findAndRemoveConsolidatedDocumentFromS3(
  cxId: string,
  patientId: string,
  dryRun = false,
  log: typeof console.log
): Promise<void> {
  const dryRunMsg = getDryRunPrefix(dryRun);
  try {
    const consolidatedPrefix = `${createFolderName(
      cxId,
      patientId
    )}/${cxId}_${patientId}_consolidated`;
    const medicalRecordsPrefix = `${createFolderName(cxId, patientId)}/${cxId}_${patientId}_MR`;

    const [existingConsolidatedFiles, existingMedicalRecordsFiles] = await Promise.all([
      s3Utils.listObjects(s3MedicalDocumentsBucketName, consolidatedPrefix),
      s3Utils.listObjects(s3MedicalDocumentsBucketName, medicalRecordsPrefix),
    ]);

    const existingFilenames: string[] = [];

    if (existingConsolidatedFiles) {
      const consolidatedFileNames = existingConsolidatedFiles
        .map(file => file.Key)
        .filter(filename => filename !== undefined) as string[];
      existingFilenames.push(...consolidatedFileNames);
    }

    if (existingMedicalRecordsFiles) {
      const medicalRecordsFileNames = existingMedicalRecordsFiles
        .map(file => file.Key)
        .filter(filename => filename !== undefined) as string[];
      existingFilenames.push(...medicalRecordsFileNames);
    }

    for (const file of existingFilenames) {
      log(`${dryRunMsg}Deleting file ${file} from S3`);
      if (!dryRun) {
        await s3Utils.deleteFile({ bucket: s3MedicalDocumentsBucketName, key: file });
      }
    }
  } catch (error) {
    log("Error removing consolidated documents from S3:", errorToString(error));
    throw error;
  }
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

    if (!dryRun) {
      await createOrUpdateInvalidLinks({ id: patientId, cxId, invalidLinks });
      await updateCQPatientData({ id: patientId, cxId, invalidateLinks: invalidLinks.carequality });
      await updateCwPatientData({ id: patientId, cxId, invalidateLinks: invalidLinks.commonwell });
    } else {
      log(`${dryRunMsg}Would invalidate links:`, invalidLinks);
    }
  } catch (error) {
    log("Error invalidating links:", error);
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
    log("Error deleting from OpenSearch:", error);
    throw error;
  }
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
    log("Error deleting FHIR resource:", error);
    throw error;
  }
}
