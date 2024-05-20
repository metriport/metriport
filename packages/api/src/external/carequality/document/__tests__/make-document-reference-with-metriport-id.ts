import { faker } from "@faker-js/faker";
import { DocumentReferenceWithMetriportId } from "../shared";

export function makeDocumentReference({
  homeCommunityId,
  docUniqueId,
  repositoryUniqueId,
  fileName,
  fileLocation,
  size,
  urn,
  newRepositoryUniqueId,
  newDocumentUniqueId,
  contentType,
  language,
  url,
  uri,
  isNew,
  creation,
  title,
}: Partial<DocumentReferenceWithMetriportId> = {}) {
  return {
    homeCommunityId: homeCommunityId ?? faker.string.uuid(),
    docUniqueId: docUniqueId ?? faker.string.uuid(),
    repositoryUniqueId: repositoryUniqueId ?? faker.string.uuid(),
    fileName: fileName ?? faker.string.alpha(),
    fileLocation: fileLocation ?? faker.string.alpha(),
    size: size ?? faker.number.int(),
    urn: urn ?? faker.string.alpha(),
    newRepositoryUniqueId: newRepositoryUniqueId ?? faker.string.uuid(),
    newDocumentUniqueId: newDocumentUniqueId ?? faker.string.uuid(),
    contentType: contentType ?? "application/xml",
    language: language,
    url: url ?? faker.internet.url(),
    uri: uri ?? faker.internet.url(),
    isNew: isNew ?? faker.datatype.boolean(),
    creation: creation ?? faker.date.past().toISOString(),
    title: title ?? faker.lorem.text(),
  };
}

export function makeDocumentReferenceWithMetriportId({
  metriportId,
  ...rest
}: Partial<DocumentReferenceWithMetriportId> = {}): DocumentReferenceWithMetriportId {
  const baseDocumentReference = makeDocumentReference(rest);
  return {
    ...baseDocumentReference,
    metriportId: metriportId ?? faker.string.uuid(),
  };
}
