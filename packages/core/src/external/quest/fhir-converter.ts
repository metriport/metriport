import { BadRequestError } from "@metriport/shared";
import { S3Utils } from "../aws/s3";
import { convertTabularDataToFhirBundle } from "./fhir/bundle";
import { getDateIdFromSourceDocumentFileName } from "./file/file-names";
import { parseResponseFile } from "./file/file-parser";
import { getPatientMapping } from "./api/patient-mapping";
import { QuestFhirConversionRequest, QuestFhirConversionResponse } from "./types";
import { Config } from "../../util/config";

export async function convertSourceDocumentToFhirBundle({
  externalId,
  sourceDocumentKey,
}: QuestFhirConversionRequest): Promise<QuestFhirConversionResponse> {
  const { patientId, cxId } = await getPatientMapping({ externalId });
  const dateId = getDateIdFromSourceDocumentFileName(sourceDocumentKey);
  const sourceDocument = await getSourceDocument(sourceDocumentKey);
  if (!sourceDocument) {
    throw new BadRequestError(`Source document not found for FHIR conversion`, undefined, {
      externalId,
      sourceDocumentKey,
    });
  }

  const rows = parseResponseFile(sourceDocument);
  const bundle = await convertTabularDataToFhirBundle({ cxId, patientId, rows });
  return {
    bundle,
    cxId,
    patientId,
    dateId,
  };
}

async function getSourceDocument(sourceDocumentKey: string): Promise<Buffer | undefined> {
  const s3 = new S3Utils(Config.getAWSRegion());
  const bucketName = Config.getQuestReplicaBucketName();
  if (!bucketName) return undefined;

  const object = await s3.downloadFile({
    bucket: bucketName,
    key: sourceDocumentKey,
  });
  return object;
}
