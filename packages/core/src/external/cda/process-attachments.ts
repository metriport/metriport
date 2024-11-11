import {
  Attachment,
  Bundle,
  CodeableConcept,
  Coding,
  DocumentReference,
  Extension,
  Identifier,
  Resource,
} from "@medplum/fhirtypes";
import { executeWithNetworkRetries } from "@metriport/shared";
import { buildDayjs } from "@metriport/shared/common/date";
import { MedicalDataSource, isMedicalDataSource } from "..";
import { createAttachmentUploadFilePath } from "../../domain/document/upload";
import {
  CdaCodeCv,
  CdaInstanceIdentifier,
  CdaOriginalText,
  ConcernActEntryAct,
  EffectiveTimeLowHigh,
} from "../../fhir-to-cda/cda-types/shared-types";
import { executeAsynchronously } from "../../util/concurrency";
import { Config } from "../../util/config";
import { out } from "../../util/log";
import { sizeInBytes } from "../../util/string";
import { uuidv4 } from "../../util/uuid-v7";
import { S3Utils, UploadParams } from "../aws/s3";
import { cqExtension } from "../carequality/extension";
import { cwExtension } from "../commonwell/extension";
import { makeFhirApi } from "../fhir/api/api-factory";
import { convertCollectionBundleToTransactionBundle } from "../fhir/bundle/convert-to-transaction-bundle";
import { buildDocIdFhirExtension } from "../fhir/shared/extensions/doc-id-extension";

const region = Config.getAWSRegion();

function getS3UtilsInstance(): S3Utils {
  return new S3Utils(region);
}
export async function processAttachments({
  b64Attachments,
  cxId,
  patientId,
  filePath,
  medicalDataSource,
  s3BucketName,
  fhirUrl,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  b64Attachments: any[];
  cxId: string;
  patientId: string;
  filePath: string;
  medicalDataSource?: string | undefined;
  s3BucketName: string | undefined;
  fhirUrl?: string;
}) {
  const { log } = out(`processAttachments - cxId ${cxId}, patientId ${patientId}`);
  const s3Utils = getS3UtilsInstance();

  const extensions = [buildDocIdFhirExtension(filePath), getSourceExtension(medicalDataSource)]
    .flat()
    .filter(Boolean) as Extension[];

  const docRefs: DocumentReference[] = [];
  const uploadDetails: UploadParams[] = [];

  b64Attachments.map(async att => {
    const act = att.act as ConcernActEntryAct;

    const fileDetails = getDetails(act.text);
    if (!fileDetails.fileB64Contents) return;

    const docRef = buildDocumentReference(patientId, extensions, act);
    if (!docRef.id) throw new Error("Missing ID in DocRef");

    const fileKey = createAttachmentUploadFilePath({
      filePath,
      attachmentId: docRef.id,
      mimeType: fileDetails.mimeType,
    });

    const fileUrl = s3BucketName ? s3Utils.buildFileUrl(s3BucketName, fileKey) : undefined;

    const attachment: Attachment = {
      ...(fileDetails.mimeType && { contentType: fileDetails.mimeType }),
      ...(fileUrl && { url: fileUrl }),
      size: sizeInBytes(fileDetails.fileB64Contents),
      title: fileKey,
    };

    if (docRef.date) attachment.creation = docRef.date;
    docRef.content = [{ attachment }];

    docRefs.push(docRef);

    if (s3BucketName) {
      const uploadParams = {
        bucket: s3BucketName,
        key: fileKey,
        file: Buffer.from(fileDetails.fileB64Contents, "base64"),
        ...(fileDetails.mimeType && { contentType: fileDetails.mimeType }),
      };
      uploadDetails.push(uploadParams);
    }
  });

  log(`Extracted ${docRefs.length} attachments`);
  const docRefBundleEntries = docRefs.map(dr => ({ resource: dr }));
  const collectionBundle: Bundle = {
    resourceType: "Bundle",
    type: "collection",
    entry: docRefBundleEntries,
  };

  const transactionBundle = convertCollectionBundleToTransactionBundle({
    fhirBundle: collectionBundle,
  });

  if (transactionBundle.entry?.length) {
    await Promise.all([
      fhirUrl ? handleFhirUpload(cxId, transactionBundle, fhirUrl, log) : undefined,
      s3BucketName ? handleS3Upload(uploadDetails, s3Utils, log) : undefined,
    ]);
  }
  log(`Done...`);
}

async function handleFhirUpload(
  cxId: string,
  transactionBundle: Bundle<Resource>,
  fhirUrl: string,
  log: typeof console.log
): Promise<void> {
  log(`Transaction bundle: ${JSON.stringify(transactionBundle)}`);
  const fhirApi = makeFhirApi(cxId, fhirUrl);
  await executeWithNetworkRetries(async () => await fhirApi.executeBatch(transactionBundle), {
    log,
  });
}

async function handleS3Upload(
  uploadDetails: UploadParams[],
  s3Utils: S3Utils,
  log: typeof console.log
): Promise<void> {
  log(`Upload details: ${JSON.stringify(uploadDetails)}`);
  await executeAsynchronously(uploadDetails, async (uploadParams: UploadParams) => {
    await s3Utils.uploadFile(uploadParams);
  });
}

function buildDocumentReferenceDraft(
  patientId: string,
  extensions: Extension[]
): DocumentReference {
  return {
    resourceType: "DocumentReference",
    status: "current",
    docStatus: "final",
    subject: {
      reference: `Patient/${patientId}`,
      type: "Patient",
    },
    extension: extensions,
  };
}

function getDetails(document: CdaOriginalText | undefined): {
  fileB64Contents: string | undefined;
  mimeType: string | undefined;
} {
  const fileB64Contents = document?.["#text"];
  const mimeType = document?._mediaType;

  return {
    fileB64Contents,
    mimeType,
  };
}

function buildDocumentReference(
  patientId: string,
  extensions: Extension[],
  act: ConcernActEntryAct
) {
  const docRef = buildDocumentReferenceDraft(patientId, extensions);
  const identifiers = getIdentifiers(act.id);
  const date = getDate(act.effectiveTime);
  const type = getType(act.code);

  docRef.id = uuidv4();

  if (identifiers.length) docRef.identifier = identifiers;
  if (type) {
    docRef.type = type;
    if (type.text) docRef.description = type.text;
  }
  if (date) docRef.date = date;

  return docRef;
}

function getIdentifiers(id: CdaInstanceIdentifier | undefined): Identifier[] {
  return [
    {
      ...(id?._root && { system: id._root }),
      ...(id?._extension && { value: id._extension }),
    },
  ];
}

function getSourceExtension(medicalSource: string | undefined): Extension | undefined {
  if (isMedicalDataSource(medicalSource)) {
    if (medicalSource === MedicalDataSource.CAREQUALITY) return cqExtension;
    if (medicalSource === MedicalDataSource.COMMONWELL) return cwExtension;
  }
  return undefined;
}

function getDate(time: EffectiveTimeLowHigh | undefined): string | undefined {
  if (time?.low?._value) return buildDayjs(normalizeDateFromXml(time.low._value)).toISOString();
  if (time?.high?._value) return buildDayjs(normalizeDateFromXml(time.high._value)).toISOString();
  return undefined;
}

function normalizeDateFromXml(dateString: string) {
  if (dateString.includes("+")) {
    return dateString.split("+")[0];
  }
  if (dateString.includes("-")) {
    return dateString.split("-")[0];
  }
  return dateString;
}

function getType(code: CdaCodeCv | undefined): CodeableConcept | undefined {
  const codings: Coding[] = [];
  if (code) {
    const coding: Coding = {};
    if (code?._codeSystem) coding.system = code._codeSystem;
    if (code?._code) coding.code = code._code;
    if (code?._displayName) coding.display = code._displayName;

    if (Object.keys(coding).length > 0) codings.push(coding);
  }

  const origText =
    typeof code?.originalText === "string" ? code.originalText : code?.originalText?.["#text"];

  const codeText = origText ?? code?.translation?.[0]?._displayName ?? undefined;

  const concept: CodeableConcept = {};
  if (codings.length) concept.coding = codings;
  if (codeText) concept.text = codeText;

  if (Object.keys(concept).length) return concept;
  return undefined;
}
