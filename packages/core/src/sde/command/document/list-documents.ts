import _ from "lodash";
import path from "path";
import { Config } from "../../../util/config";
import { out } from "../../../util/log";
import { S3Utils } from "../../../external/aws/s3";
import {
  createDocumentFilePathPrefix,
  parseDocumentFileName,
} from "../../../domain/document/filename";

const documentKeySuffix = ".xml.json";

export async function listDocumentIds({
  cxId,
  patientId,
}: {
  cxId: string;
  patientId: string;
}): Promise<string[]> {
  const { log } = out(`sde.listDocumentIds - cx ${cxId}, pat ${patientId}`);

  const s3 = new S3Utils(Config.getAWSRegion());
  const bucketName = Config.getCdaToFhirConversionBucketName();
  if (!bucketName) {
    log(`No cda to fhir conversion bucket name found`);
    return [];
  }

  const prefix = createDocumentFilePathPrefix(cxId, patientId);
  const documents = await s3.listObjects(bucketName, prefix);

  const documentIds = _(documents)
    .map(document => document.Key)
    .compact()
    .filter(key => key.endsWith(documentKeySuffix))
    .map(key => {
      const { docId } = parseDocumentFileName(key);
      return path.basename(docId, ".xml");
    })
    .compact()
    .value();

  return documentIds;
}
