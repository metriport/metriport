import { faker } from "@faker-js/faker";
import { DeepNullable } from "ts-essentials";
import { makeOptionalNumber } from "../../../shared/__tests__/utils";
import { DocumentQueryProgress, documentQueryStatus, Progress } from "../document-query";

export function makeProgress(seed: Partial<DeepNullable<Progress>> = {}): Progress {
  return {
    status: seed.status ?? faker.helpers.arrayElement(documentQueryStatus),
    total: makeOptionalNumber(seed.total),
    successful: makeOptionalNumber(seed.successful),
    errors: makeOptionalNumber(seed.errors),
  };
}

export function makeDocumentQueryProgress(
  seed: Partial<DocumentQueryProgress> = {}
): DocumentQueryProgress {
  return {
    download: makeProgress(seed.download),
    convert: makeProgress(seed.convert),
    requestId: seed.requestId === null ? undefined : seed.requestId ?? faker.datatype.uuid(),
  };
}
