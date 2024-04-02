import {
  Progress,
  DocumentQueryStatus,
  documentQueryStatus,
} from "@metriport/core/domain/document-query";
import { faker } from "@faker-js/faker";
import { makeOptionalNumber } from "../../../shared/__tests__/utils";

export const createProgress = ({
  status,
  manuelProg,
}: {
  status?: DocumentQueryStatus;
  manuelProg?: Progress;
}): Progress => {
  const total = makeOptionalNumber(undefined) ?? 0;
  const errors = makeOptionalNumber(undefined) ?? 0;
  const successful = makeOptionalNumber(undefined) ?? 0;

  if (status === "completed") {
    return {
      total: successful + errors,
      errors,
      status,
      successful,
    };
  } else if (status === "failed") {
    return {
      total: makeOptionalNumber(undefined) ?? 0,
      errors,
      status,
      successful,
    };
  } else if (status === "processing") {
    return {
      total: successful + errors + 1,
      errors,
      status,
      successful,
    };
  }

  return {
    total: manuelProg?.total ?? total,
    errors: manuelProg?.errors ?? errors,
    status: manuelProg?.status ?? faker.helpers.arrayElement(documentQueryStatus),
    successful: manuelProg?.successful ?? successful,
  };
};

export const addProgresses = (
  progress1: Progress,
  progress2: Progress,
  status: DocumentQueryStatus
): Progress => {
  return {
    total: (progress1.total ?? 0) + (progress2.total ?? 0),
    errors: (progress1.errors ?? 0) + (progress2.errors ?? 0),
    status: status,
    successful: (progress1.successful ?? 0) + (progress2.successful ?? 0),
  };
};
