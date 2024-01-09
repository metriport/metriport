import { DocumentQueryRequestIncoming } from "@metriport/ihe-gateway-sdk";
import { S3Utils } from "../../aws/s3";
import { Config } from "../../../util/config";
import { XDSUnknownPatientId } from "../error";
import { validateBasePayload } from "../shared";
const medicalDocumentsBucketName = Config.getMedicalDocumentsBucketName();
const region = Config.getAWSRegion();

export function decodePatientId(patientIdB64: string): { cxId: string; id: string } | undefined {
  const decodedString = atob(patientIdB64);
  const [cxId, id] = decodedString.split("/");

  if (!cxId || !id) {
    return undefined;
  }

  return { cxId, id };
}

export async function validateDQ(payload: DocumentQueryRequestIncoming): Promise<string[]> {
  validateBasePayload(payload);
  const id_pair = decodePatientId(payload.xcpdPatientId.id);

  if (!id_pair) {
    throw new XDSUnknownPatientId("Patient ID is not valid");
  }
  const { cxId, id } = id_pair;

  const s3Utils = new S3Utils(region);
  const documentContents = await s3Utils.retrieveDocumentIdsFromS3(
    cxId,
    id,
    medicalDocumentsBucketName
  );

  if (!documentContents) {
    throw new XDSUnknownPatientId("Patient ID is not valid");
  }
  return documentContents;
}
