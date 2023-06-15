import { faker } from "@faker-js/faker";
import { DeepNullable } from "ts-essentials";
import { makeOptionalNumber } from "../../../shared/__tests__/utils";
import { documentQueryStatus, Progress } from "../document-reference";

export function makeProgress(seed: Partial<DeepNullable<Progress>> = {}): Progress {
  return {
    status: seed.status ?? faker.helpers.arrayElement(documentQueryStatus),
    total: makeOptionalNumber(seed.total),
    successful: makeOptionalNumber(seed.successful),
    errors: makeOptionalNumber(seed.errors),
  };
}
