import { DocumentQueryRequestIncoming } from "@metriport/ihe-gateway-sdk";
import { retrieveDocumentIdsFromS3 } from "./s3-operations";

export class XDSUnknownPatientId extends Error {
  constructor(message?: string) {
    super(message);
    this.name = "XDSUnknownPatientId";
  }
}

export class XDSUnknownCommunity extends Error {
  constructor(message?: string) {
    super(message);
    this.name = "XDSUnknownCommunity";
  }
}

export class XDSMissingHomeCommunityId extends Error {
  constructor(message?: string) {
    super(message);
    this.name = "XDSMissingHomeCommunityId";
  }
}

export class XDSRegistryError extends Error {
  constructor(message?: string) {
    super(message);
    this.name = "XDSRegistryError";
  }
}

export function decodePatientId(patientIdB64: string): { cxId: string; id: string } | undefined {
  const decodedString = atob(patientIdB64);
  const [cxId, id] = decodedString.split("/");

  if (!cxId || !id) {
    return undefined;
  }

  return { cxId, id };
}

export async function validateITI38Request(
  payload: DocumentQueryRequestIncoming
): Promise<string[]> {
  if (!payload.id) {
    throw new XDSRegistryError("Request id is not defined");
  }

  if (!payload.timestamp) {
    throw new XDSRegistryError("Timestamp is not defined");
  }

  if (!payload.samlAttributes.homeCommunityId) {
    throw new XDSMissingHomeCommunityId("Home Community ID is not defined");
  }

  const id_pair = decodePatientId(payload.xcpdPatientId.id);

  if (!id_pair) {
    throw new XDSUnknownPatientId("Patient ID is not valid");
  }
  const { cxId, id } = id_pair;

  const documentIds = await retrieveDocumentIdsFromS3(cxId, id);

  if (!documentIds) {
    throw new XDSUnknownPatientId("Patient ID is not valid");
  }
  return documentIds;

  // Add more validation checks as needed
}
