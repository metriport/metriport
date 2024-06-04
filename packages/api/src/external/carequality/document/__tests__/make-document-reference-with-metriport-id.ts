import { faker } from "@faker-js/faker";
import { DocumentReferenceWithMetriportId } from "../shared";
import { DocumentReference } from "@metriport/ihe-gateway-sdk";

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
}: Partial<DocumentReferenceWithMetriportId> = {}): DocumentReference {
  const _homeCommunityId = homeCommunityId ?? faker.string.uuid();
  const _docUniqueId = docUniqueId ?? faker.string.uuid();
  const _repositoryUniqueId = repositoryUniqueId ?? faker.string.uuid();
  const _fileName = fileName ?? faker.string.alpha();
  const _fileLocation = fileLocation ?? faker.string.alpha();
  const _size = size ?? faker.number.int();
  const _urn = urn ?? faker.string.alpha();
  const _newRepositoryUniqueId = newRepositoryUniqueId ?? faker.string.uuid();
  const _newDocumentUniqueId = newDocumentUniqueId ?? faker.string.uuid();
  const _contentType = contentType ?? "application/xml";
  const _language = language;
  const _url = url ?? faker.internet.url();
  const _uri = uri ?? faker.internet.url();
  const _isNew = isNew ?? faker.datatype.boolean();
  const _creation = creation ?? faker.date.past().toISOString();
  const _title = title ?? faker.lorem.text();
  return {
    homeCommunityId: _homeCommunityId,
    docUniqueId: _docUniqueId,
    repositoryUniqueId: _repositoryUniqueId,
    fileName: _fileName,
    fileLocation: _fileLocation,
    size: _size,
    urn: _urn,
    newRepositoryUniqueId: _newRepositoryUniqueId,
    newDocumentUniqueId: _newDocumentUniqueId,
    contentType: _contentType,
    language: _language,
    url: _url,
    uri: _uri,
    isNew: _isNew,
    creation: _creation,
    title: _title,
  };
}

export function makeDocumentReferenceWithMetriportId({
  metriportId,
  ...rest
}: Partial<DocumentReferenceWithMetriportId> = {}): DocumentReferenceWithMetriportId {
  const baseDocumentReference = makeDocumentReference(rest);
  const _metriportId = metriportId ?? faker.string.uuid();
  return {
    ...baseDocumentReference,
    metriportId: _metriportId,
  };
}
