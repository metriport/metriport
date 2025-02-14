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
import { getEnvVarOrFail } from "@metriport/shared";
import { DocumentReferenceWithId } from "@metriport/core/external/fhir/document/document-reference";
import { isOrganization, isPatient } from "@metriport/core/external/fhir/shared";
import { hasCommonwellContent } from "@metriport/core/external/commonwell/extension";
import { hasCarequalityContent } from "@metriport/core/external/carequality/extension";
import { getCQPatientData } from "../../external/carequality/command/cq-patient-data/get-cq-data";
import { getCwPatientData } from "../../external/commonwell/command/cw-patient-data/get-cw-data";
import { CQData } from "../../external/carequality/cq-patient-data";
import { CwData } from "../../external/commonwell/cw-patient-data";
import { CwLink } from "../../external/commonwell/cw-patient-data";
import { CQLink } from "../../external/carequality/cq-patient-data";
import { Config } from "../../shared/config";

const s3Utils = new S3Utils(Config.getAWSRegion());
const s3ConversionResultBucketName = getEnvVarOrFail("CONVERSION_RESULT_BUCKET_NAME");

type UnlinkPatientFromOrganizationParams = {
  cxId: string;
  patientId: string;
  oid: string;
};

export async function unlinkPatientFromOrganization({
  cxId,
  patientId,
  oid,
}: UnlinkPatientFromOrganizationParams): Promise<void> {
  const { log } = out(`unlinkPatientFromOrganization - M patient ${patientId}`);

  const cqPatientData = await getCQPatientData({ id: patientId, cxId });
  const cwPatientData = await getCwPatientData({ id: patientId, cxId });

  const cwLink = findCwLinkWithOid(cwPatientData?.data, oid);
  const cqLink = findCqLinkWithOid(cqPatientData?.data, oid);

  const documents = await getDocuments({ cxId, patientId });

  const documentsWithOid = getDocumentsWithOid(documents, oid);

  for (const document of documentsWithOid) {
    const fileName = getS3FileNameFromDocument(document);
    if (!fileName) continue;

    await findAndRemoveConversionResultsFromS3(fileName);

    // await s3Utils.deleteFile({ bucket: s3BucketName, key: fileName });
  }
}

function findCwLinkWithOid(cwPatientData: CwData | undefined, oid: string): CwLink | undefined {
  if (!cwPatientData) return undefined;

  const cwLinks = cwPatientData.links;

  for (const cwLink of cwLinks) {
    const patient = cwLink.patient;
    if (!patient) continue;

    const identifier = patient.details.identifier?.find(
      identifier => identifier.assigner !== "Commonwell" && identifier.system === oid
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
  const urnOid = `urn:oid:${oid}`;
  const commonwellDocuments = documents.filter(hasCommonwellContent);
  const carequalityDocuments = documents.filter(hasCarequalityContent);

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

async function findAndRemoveConversionResultsFromS3(fileName: string): Promise<void> {
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

  const validFiles = existingFiles.filter(fileName => fileName !== undefined);

  for (const fileName of validFiles) {
    console.log(`Deleting file ${fileName} from S3`);
    // await s3Utils.deleteFile({ bucket: s3ConversionResultBucketName, key: fileName });
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
