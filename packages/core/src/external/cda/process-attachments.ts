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
import { errorToString, executeWithNetworkRetries, toArray } from "@metriport/shared";
import { buildDayjs } from "@metriport/shared/common/date";
import { createUuidFromText } from "@metriport/shared/common/uuid";
import { MedicalDataSource, isMedicalDataSource } from "..";
import { createAttachmentUploadFilePath } from "../../shareback/file";
import {
  CdaCodeCv,
  CdaInstanceIdentifier,
  CdaOriginalText,
  CdaValueCd,
  CdaValueEd,
  CdaValuePq,
  CdaValueSt,
  ConcernActEntryAct,
  EffectiveTimeLowHigh,
  EffectiveTimeValue,
  Entry,
  ObservationMedia,
  ObservationOrganizer,
  ObservationEntry,
} from "../../fhir-to-cda/cda-types/shared-types";
import { capture } from "../../util";
import { isValidBase64 } from "../../util/base64";
import { executeAsynchronously } from "../../util/concurrency";
import { Config } from "../../util/config";
import { detectFileType } from "../../util/file-type";
import { out } from "../../util/log";
import { OCTET_MIME_TYPE } from "../../util/mime";
import { sizeInBytes } from "../../util/string";
import { S3Utils, UploadParams } from "../aws/s3";
import { cqExtension } from "../carequality/extension";
import { cwExtension } from "../commonwell/extension";
import { makeFhirApi } from "../fhir/api/api-factory";
import { convertCollectionBundleToTransactionBundle } from "../fhir/bundle/convert-to-transaction-bundle";
import { buildDocIdFhirExtension } from "../fhir/shared/extensions/doc-id-extension";
import { B64Attachments } from "./remove-b64";
import { groupObservations } from "./shared";

const region = Config.getAWSRegion();

const CLIENT_ASSIGNED_ID_CONSTRAINT_FAILURE = "HAPI-0825";

function getS3UtilsInstance(): S3Utils {
  return new S3Utils(region);
}

type FileDetails = {
  fileB64Contents: string;
  mimeType: string | undefined;
};

type MediaTypeProvider = {
  _mediaType?: string;
};

type ObservationValueElement = CdaValuePq | CdaValueCd | CdaValueEd | CdaValueSt;

function hasTextContent(value: ObservationValueElement): value is CdaValueEd | CdaValueSt {
  return "#text" in value;
}

type SentryParams = {
  patientId: string;
  cxId: string;
  filePath: string;
};

export async function processAttachments({
  b64Attachments,
  cxId,
  patientId,
  filePath,
  s3BucketName,
  fhirUrl,
  medicalDataSource,
}: {
  b64Attachments: B64Attachments;
  cxId: string;
  patientId: string;
  filePath: string;
  s3BucketName: string;
  fhirUrl: string;
  medicalDataSource?: string | undefined;
}) {
  const baseLogPrefix = `processAttachments - filepath ${filePath}`;
  const { log } = out(baseLogPrefix);
  try {
    const s3Utils = getS3UtilsInstance();

    const extensions = [buildDocIdFhirExtension(filePath), getSourceExtension(medicalDataSource)]
      .flat()
      .filter(Boolean) as Extension[];

    const docRefs: DocumentReference[] = [];
    const uploadDetails: UploadParams[] = [];

    const contextParams: SentryParams = { patientId, cxId, filePath };
    b64Attachments.acts.map(act => {
      const fileDetails = getDetailsForAct(act.text, baseLogPrefix, contextParams);
      if (!fileDetails) return;

      const docRef = buildDocumentReferenceFromAct(patientId, extensions, act);
      if (!docRef.id) throw new Error("Missing ID in DocRef");

      const fileKey = createAttachmentUploadFilePath({
        filePath,
        attachmentId: docRef.id,
        mimeType: fileDetails.mimeType,
      });
      const fileUrl = s3Utils.buildFileUrl(s3BucketName, fileKey);

      const attachment = buildAttachment(fileDetails, fileUrl, fileKey);

      if (docRef.date) attachment.creation = docRef.date;
      docRef.content = [{ attachment }];
      const uploadParams = buildUploadParams(fileDetails, s3BucketName, fileKey);

      uploadDetails.push(uploadParams);
      docRefs.push(docRef);
    });

    b64Attachments.organizers.map(organizerEntry => {
      const { mediaObservations } = groupObservations(organizerEntry);

      mediaObservations.map(mediaEntry => {
        const obsMedia = mediaEntry.observationMedia;
        const fileDetails = getDetailsForMediaObs(obsMedia.value, baseLogPrefix, contextParams);

        if (!fileDetails) return;

        const docRef = buildDocumentReferenceFromObsMedia(
          patientId,
          extensions,
          organizerEntry,
          obsMedia
        );
        if (!docRef.id) throw new Error("Missing ID in DocRef");
        const fileKey = createAttachmentUploadFilePath({
          filePath,
          attachmentId: docRef.id,
          mimeType: fileDetails.mimeType,
        });

        const fileUrl = s3Utils.buildFileUrl(s3BucketName, fileKey);

        const attachment = buildAttachment(fileDetails, fileUrl, fileKey);
        docRef.content = [{ attachment }];
        const uploadParams = buildUploadParams(fileDetails, s3BucketName, fileKey);
        uploadDetails.push(uploadParams);
        docRefs.push(docRef);
      });
    });

    b64Attachments.nonMediaObservations.map(obs => {
      const values = toArray(obs.observation?.value);

      values.forEach((value, valueIndex) => {
        const fileDetails = getDetailsForNonMediaObs(value, baseLogPrefix, contextParams);
        if (!fileDetails) return;

        const docRef = buildDocumentReferenceFromNonMediaObs(
          patientId,
          extensions,
          obs,
          valueIndex
        );
        if (!docRef.id) throw new Error("Missing ID in DocRef");

        const fileKey = createAttachmentUploadFilePath({
          filePath,
          attachmentId: docRef.id,
          mimeType: fileDetails.mimeType,
        });
        const fileUrl = s3Utils.buildFileUrl(s3BucketName, fileKey);
        const attachment = buildAttachment(fileDetails, fileUrl, fileKey);
        docRef.content = [{ attachment }];

        const uploadParams = buildUploadParams(fileDetails, s3BucketName, fileKey);
        uploadDetails.push(uploadParams);
        docRefs.push(docRef);
      });
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
        handleFhirUpload(cxId, transactionBundle, fhirUrl, log),
        handleS3Upload(uploadDetails, s3Utils, log),
      ]);
    }
  } catch (error) {
    const msg = `Failed to process attachments - not interrupting main flow`;
    const errorMessage = errorToString(error);
    log(`${msg} - ${errorMessage}`);

    if (!errorMessage.includes(CLIENT_ASSIGNED_ID_CONSTRAINT_FAILURE)) {
      capture.message(msg, {
        extra: {
          cxId,
          patientId,
          filePath,
          s3BucketName,
          fhirUrl,
          medicalDataSource,
          numberOfAttachments: b64Attachments.total,
          errorMessage,
        },
        level: "warning",
      });
    }
  }
  log(`Done...`);
}

async function handleFhirUpload(
  cxId: string,
  transactionBundle: Bundle<Resource>,
  fhirUrl: string,
  log: typeof console.log
): Promise<void> {
  log(`[handleFhirUpload] Transaction bundle: ${JSON.stringify(transactionBundle)}`);
  const fhirApi = makeFhirApi(cxId, fhirUrl);
  await executeWithNetworkRetries(async () => await fhirApi.executeBatch(transactionBundle), {
    log,
  });
  log(`[handleFhirUpload] Done`);
}

async function handleS3Upload(
  uploadDetails: UploadParams[],
  s3Utils: S3Utils,
  log: typeof console.log
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const detailsToLog = uploadDetails.map(({ file, ...d }) => d);
  log(`[handleS3Upload] Upload details: ${JSON.stringify(detailsToLog)}`);
  await executeAsynchronously(uploadDetails, async (uploadParams: UploadParams) => {
    await s3Utils.uploadFile(uploadParams);
  });
  log(`[handleS3Upload] Done`);
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

function getDetailsForAct(
  document: CdaOriginalText | undefined,
  baseLogPrefix: string,
  contextParams: SentryParams
): FileDetails | undefined {
  return getFileDetails(document?.["#text"], document ?? {}, baseLogPrefix, "Act", contextParams);
}

function getDetailsForMediaObs(
  value: CdaValueEd | undefined,
  baseLogPrefix: string,
  contextParams: SentryParams
): FileDetails | undefined {
  return getFileDetails(value?.["#text"], value ?? {}, baseLogPrefix, "MediaObs", contextParams);
}

function getDetailsForNonMediaObs(
  value: ObservationValueElement | undefined,
  baseLogPrefix: string,
  contextParams: SentryParams
): FileDetails | undefined {
  const text = value && hasTextContent(value) ? value["#text"] : undefined;
  return getFileDetails(text, value ?? {}, baseLogPrefix, "NonMediaObs", contextParams);
}

function getFileDetails(
  fileB64Contents: string | undefined,
  mediaTypeProvider: MediaTypeProvider | Record<string, unknown>,
  baseLogPrefix: string,
  prefix: string,
  contextParams: SentryParams
): FileDetails | undefined {
  const { log: prefixedLog } = out(`${baseLogPrefix} - ${prefix}`);
  if (!fileB64Contents) return undefined;

  // Clean up the base64 string - remove any whitespace, newlines etc
  const cleanB64 = fileB64Contents.replace(/\s/g, "");
  const unquotedB64 = cleanB64.replace(/^["']|["']$/g, "");

  if (!isValidBase64(unquotedB64)) {
    const msg = `Invalid base64 string in attachment`;
    prefixedLog(msg);
    capture.message(msg, {
      extra: { ...contextParams },
      level: "info",
    });

    return undefined;
  }

  const fileBuffer = Buffer.from(unquotedB64, "base64");
  let mimeType = detectFileType(fileBuffer).mimeType;
  prefixedLog(`[getFileDetails] Detected mimetype: ${mimeType}`);

  const specifiedMediaType =
    typeof mediaTypeProvider._mediaType === "string" ? mediaTypeProvider._mediaType : undefined;
  if (mimeType === OCTET_MIME_TYPE && specifiedMediaType) {
    prefixedLog(`[getFileDetails] Will use specified mimetype: ${specifiedMediaType}`);
    mimeType = specifiedMediaType;
  }

  return {
    fileB64Contents: unquotedB64,
    mimeType,
  };
}

function buildDocumentReferenceFromAct(
  patientId: string,
  extensions: Extension[],
  act: ConcernActEntryAct
) {
  const docRef = buildDocumentReferenceDraft(patientId, extensions);
  const docRefId = createUuidFromText(JSON.stringify(act) + `${patientId}`);
  const identifiers = getIdentifiers(act.id);
  const date = getDate(act.effectiveTime);
  const type = getType(act.code);

  return fillDocumentReference(docRef, {
    docRefId,
    identifiers,
    type,
    date,
  });
}

function getIdentifiers(
  id: CdaInstanceIdentifier | CdaInstanceIdentifier[] | Entry | undefined
): Identifier[] {
  const ids = toArray(id);
  return ids
    .map(item => {
      if (typeof item === "string") return undefined;
      return {
        ...(item._root && { system: item._root }),
        ...(item._extension && { value: item._extension }),
      };
    })
    .filter((id): id is Identifier => id != null && (!!id.system || !!id.value));
}

function getSourceExtension(medicalSource: string | undefined): Extension | undefined {
  if (isMedicalDataSource(medicalSource)) {
    if (medicalSource === MedicalDataSource.CAREQUALITY) return cqExtension;
    if (medicalSource === MedicalDataSource.COMMONWELL) return cwExtension;
  }
  return undefined;
}

function hasLowOrHigh(
  time: EffectiveTimeLowHigh | EffectiveTimeValue
): time is EffectiveTimeLowHigh {
  return "low" in time || "high" in time;
}

function getDate(time: EffectiveTimeLowHigh | EffectiveTimeValue | undefined): string | undefined {
  if (time && "_value" in time && time._value) {
    return buildDayjs(normalizeDateFromXml(time._value)).toISOString();
  }
  if (time && hasLowOrHigh(time)) {
    if (time.low?._value) {
      return buildDayjs(normalizeDateFromXml(time.low._value)).toISOString();
    }
    if (time.high?._value) {
      return buildDayjs(normalizeDateFromXml(time.high._value)).toISOString();
    }
  }
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

function buildAttachment(fileDetails: FileDetails, fileUrl: string, fileKey: string): Attachment {
  return {
    ...(fileDetails.mimeType && { contentType: fileDetails.mimeType }),
    url: fileUrl,
    size: sizeInBytes(fileDetails.fileB64Contents),
    title: fileKey,
  };
}

function buildUploadParams(
  fileDetails: FileDetails,
  bucketName: string,
  fileKey: string
): UploadParams {
  return {
    bucket: bucketName,
    key: fileKey,
    file: Buffer.from(fileDetails.fileB64Contents, "base64"),
    ...(fileDetails.mimeType && { contentType: fileDetails.mimeType }),
  };
}

function buildDocumentReferenceFromObsMedia(
  patientId: string,
  extensions: Extension[],
  organizer: ObservationOrganizer,
  obsMedia: ObservationMedia
): DocumentReference {
  const docRef = buildDocumentReferenceDraft(patientId, extensions);
  const docRefId = createUuidFromText(JSON.stringify(obsMedia) + `${patientId}`);
  const identifiers = getIdentifiers(obsMedia.id);
  const date = getDate(organizer.effectiveTime);
  const type = getType(organizer.code);
  return fillDocumentReference(docRef, {
    docRefId,
    identifiers,
    type,
    date,
  });
}

function buildDocumentReferenceFromNonMediaObs(
  patientId: string,
  extensions: Extension[],
  obs: ObservationEntry,
  valueIndex: number
): DocumentReference {
  const docRef = buildDocumentReferenceDraft(patientId, extensions);
  const { observation } = obs;
  const docRefId = createUuidFromText(JSON.stringify(obs) + `${valueIndex}` + `${patientId}`);
  const identifiers = getIdentifiers(observation.id);
  const date = getDate(observation.effectiveTime);
  const type = getType(observation.code);
  return fillDocumentReference(docRef, {
    docRefId,
    identifiers,
    type,
    date,
  });
}

function fillDocumentReference(
  docRef: DocumentReference,
  params: {
    identifiers: Identifier[];
    docRefId: string;
    type?: CodeableConcept | undefined;
    date?: string | undefined;
  }
): DocumentReference {
  const { identifiers, type, date, docRefId } = params;
  docRef.id = docRefId;

  if (identifiers.length > 0) docRef.identifier = identifiers;
  if (type) {
    docRef.type = type;
    if (type.text) docRef.description = type.text;
  }
  if (date) docRef.date = date;
  return docRef;
}
