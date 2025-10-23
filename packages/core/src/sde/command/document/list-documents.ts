import _ from "lodash";
import { Config } from "../../../util/config";
import { out } from "../../../util/log";
import { S3Utils } from "../../../external/aws/s3";
import { getCdaToFhirConversionPrefix, parseCdaToFhirConversionFileName } from "../../file-names";

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

  const prefix = getCdaToFhirConversionPrefix({ cxId, patientId });
  const documents = await s3.listObjects(bucketName, prefix);

  const documentIds = _(documents)
    .map(document => document.Key)
    .compact()
    .filter(key => key.endsWith(documentKeySuffix))
    .map(key => {
      const { documentId } = parseCdaToFhirConversionFileName({ fileName: key });
      return documentId;
    })
    .compact()
    .value();

  return documentIds;
}
