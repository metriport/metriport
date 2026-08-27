import { encodeDocumentId, MetriportError } from "@metriport/shared";
import { DynamoDbUtils } from "../external/aws/dynamodb";
import { Config } from "../util/config";

const partitionKey = "docId";

export type DocIdMapping = {
  docId: string;
  cxId: string;
  patientId: string;
  documentS3Key: string;
};

let docIdMappingInstance: DynamoDbUtils | undefined;

function getDocIdMappingTable(): DynamoDbUtils {
  if (!docIdMappingInstance) {
    const tableName = Config.getDocIdMappingTableName();
    docIdMappingInstance = new DynamoDbUtils({
      table: tableName,
      partitionKey,
    });
  }
  return docIdMappingInstance;
}

export async function storeMappingAndEncodeDocumentId({
  cxId,
  patientId,
  documentUuid,
  documentFullPath,
}: {
  cxId: string;
  patientId: string;
  documentUuid: string;
  documentFullPath: string;
}): Promise<string> {
  await storeDocumentIdMapping({
    cxId,
    patientId,
    shortDocumentId: documentUuid,
    documentS3Key: documentFullPath,
  });
  const encodedDocId = encodeDocumentId(documentUuid);
  return encodedDocId;
}

export async function storeDocumentIdMapping({
  cxId,
  patientId,
  shortDocumentId,
  documentS3Key,
}: {
  cxId: string;
  patientId: string;
  shortDocumentId: string;
  documentS3Key: string;
}): Promise<void> {
  const docIdTable = getDocIdMappingTable();
  await docIdTable.update({
    partition: shortDocumentId,
    expression: "SET cxId = :cxId, patientId = :patientId, documentS3Key = :documentS3Key",
    expressionAttributesValues: {
      ":cxId": cxId,
      ":patientId": patientId,
      ":documentS3Key": documentS3Key,
    },
  });
}

export async function getDocIdMapping(docId: string): Promise<DocIdMapping | undefined> {
  const docIdTable = getDocIdMappingTable();
  const result = await docIdTable.get({ partition: docId });
  if (!result.Item) {
    return undefined;
  }
  return result.Item as DocIdMapping;
}

export async function getDocIdMappingOrFail(docId: string): Promise<DocIdMapping> {
  const docIdMapping = await getDocIdMapping(docId);
  if (!docIdMapping) {
    throw new MetriportError(`Document ID mapping not found`, undefined, { docId });
  }
  return docIdMapping;
}

export async function getDocumentS3KeyFromDocId(docId: string): Promise<string | undefined> {
  const result = await getDocIdMapping(docId);
  return result?.documentS3Key;
}

export async function getDocumentS3KeyFromDocIdOrFail(docId: string): Promise<string> {
  const result = await getDocIdMappingOrFail(docId);
  return result.documentS3Key;
}
