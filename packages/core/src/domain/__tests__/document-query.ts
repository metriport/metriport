import { faker } from "@faker-js/faker";
import { getOrMakeNumber } from "../../__tests__/utils";
import { DocumentQueryProgress, documentQueryStatus, Progress } from "../document-query";

export function makeDocumentQueryProgress(
  seed: Partial<DocumentQueryProgress> = {}
): DocumentQueryProgress {
  return {
    requestId: seed.requestId ?? faker.string.uuid(),
    startedAt: seed.startedAt ?? faker.date.recent(),
    download: makeProgress(seed.download),
    convert: makeProgress(seed.convert),
  };
}

export function makeProgress(seed: Partial<Progress> = {}): Progress {
  return {
    status: seed.status ?? faker.helpers.arrayElement(documentQueryStatus),
    total: getOrMakeNumber(seed.total),
    successful: getOrMakeNumber(seed.successful),
    errors: getOrMakeNumber(seed.errors),
  };
}
