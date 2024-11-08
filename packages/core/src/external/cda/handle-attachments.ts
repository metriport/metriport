import {
  Attachment,
  Bundle,
  CodeableConcept,
  Coding,
  DocumentReference,
  Extension,
  Identifier,
} from "@medplum/fhirtypes";
import { executeAsynchronously } from "@metriport/core/util/concurrency";
import { executeWithNetworkRetries } from "@metriport/shared";
import { cloneDeep } from "lodash";
import { MedicalDataSource, isMedicalDataSource } from "..";
import { createAttachmentUploadPath } from "../../domain/document/upload";
import { createFilePathFromFileName } from "../../domain/filename";
import { Config } from "../../util/config";
import { sizeInBytes } from "../../util/string";
import { uuidv4 } from "../../util/uuid-v7";
import { S3Utils, UploadParams } from "../aws/s3";
import { cqExtension } from "../carequality/extension";
import { cwExtension } from "../commonwell/extension";
import { FhirClient } from "../fhir/api/api";
import { convertCollectionBundleToTransactionBundle } from "../fhir/bundle/convert-to-transaction-bundle";
import { buildDocIdFhirExtension } from "../fhir/shared/extensions/doc-id-extension";
import { out } from "../../util/log";
import { buildDayjs } from "@metriport/shared/common/date";

const s3Utils = new S3Utils(Config.getAWSRegion());
const s3BucketName = Config.getMedicalDocumentsBucketName();

export async function processAttachments({
  b64Attachments,
  cxId,
  patientId,
  fileName,
  medicalDataSource,
  fhirApi,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  b64Attachments: any[];
  cxId: string;
  patientId: string;
  fileName: string;
  medicalDataSource: string | undefined;
  fhirApi: FhirClient;
}) {
  const { log } = out(`processAttachments - cxId ${cxId}, patientId: ${patientId}`);
  const filePath = createFilePathFromFileName(fileName.slice(1));

  const extensions = [buildDocIdFhirExtension(filePath), getSourceExtension(medicalDataSource)]
    .flat()
    .filter(Boolean) as Extension[];

  const initialDocRef: DocumentReference = {
    resourceType: "DocumentReference",
    status: "current",
    docStatus: "final",
    subject: {
      reference: `Patient/${patientId}`,
      type: "Patient",
    },
    extension: extensions,
  };

  const docRefs: DocumentReference[] = [];
  const uploadDetails: UploadParams[] = [];

  b64Attachments.map(async att => {
    const act = att.act;

    const fileDetails = getDetails(act.text);
    const docRef = fillDocumentReference(initialDocRef, act);
    if (!docRef.id) throw new Error("Missing ID in DocRef");

    const fileKey = createAttachmentUploadPath({
      fileName: filePath,
      ownId: docRef.id,
      mimeType: fileDetails.mimeType,
    });

    const fileUrl = s3Utils.buildFileUrl(s3BucketName, fileKey);
    const attachment: Attachment = {
      contentType: fileDetails.mimeType,
      url: fileUrl,
      size: sizeInBytes(fileDetails.fileB64Contents),
      title: fileKey,
    };

    if (docRef.date) attachment.creation;
    docRef.content = [{ attachment }];

    docRefs.push(docRef);

    const uploadParams = {
      bucket: s3BucketName,
      key: fileKey,
      file: Buffer.from(fileDetails.fileB64Contents, "base64"),
      contentType: fileDetails.mimeType,
    };
    uploadDetails.push(uploadParams);
  });

  log(`Extracted ${docRefs.length} attachments. Will start uploads.`);
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
    await executeWithNetworkRetries(async () => await fhirApi.executeBatch(transactionBundle), {
      log,
    });
    executeAsynchronously(uploadDetails, async uploadParams => {
      await s3Utils.uploadFile(uploadParams);
    });
  }
  log(`Done...`);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getDetails(document: any): {
  fileB64Contents: string;
  mimeType: string;
} {
  const fileB64Contents = document?.["#text"];
  const mimeType = document?.["@_mediaType"];

  return {
    fileB64Contents,
    mimeType,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function fillDocumentReference(initDocRef: DocumentReference, act: any) {
  const updatedDocRef = cloneDeep(initDocRef);
  const identifiers = getIdentifiers(act.id);
  const date = getDate(act.effectiveTime);
  const type = getType(act.code);

  updatedDocRef.id = uuidv4();

  if (identifiers.length) updatedDocRef.identifier = identifiers;
  if (type) {
    updatedDocRef.type = type;
    if (type.text) updatedDocRef.description = type.text;
  }
  if (date) updatedDocRef.date = date;

  return updatedDocRef;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getIdentifiers(id: any): Identifier[] {
  return [
    {
      system: id["@_root"],
      value: id["@_extension"],
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getDate(time: any): string | undefined {
  if (time.low["@_value"])
    return buildDayjs(normalizeDateFromFhir(time.low["@_value"])).toISOString();
  if (time.high["@_value"])
    return buildDayjs(normalizeDateFromFhir(time.low["@_value"])).toISOString();
  return undefined;
}

function normalizeDateFromFhir(dateString: string) {
  if (dateString.includes("+")) {
    return dateString.split("+")[0];
  }
  if (dateString.includes("-")) {
    return dateString.split("-")[0];
  }
  return dateString;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getType(code: any): CodeableConcept | undefined {
  const codings: Coding[] = [];
  if (code) {
    const coding: Coding = {};
    if (code["@_codeSystem"]) coding.system = code["@_codeSystem"];
    if (code["@_code"]) coding.code = code["@_code"];
    if (code["@_displayName"]) coding.display = code["@_displayName"];

    if (Object.keys(coding).length > 0) codings.push(coding);
  }

  const codeText = code.originalText ?? code.translation["@_displayName"] ?? undefined;

  const concept: CodeableConcept = {};
  if (codings.length) concept.coding = codings;
  if (codeText) concept.text = codeText;

  if (Object.keys(concept).length) return concept;
  return undefined;
}
