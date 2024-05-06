import {
  Progress,
  DocumentQueryStatus,
  documentQueryStatus,
} from "@metriport/core/domain/document-query";
import { faker } from "@faker-js/faker";

export const createProgressFromStatus = ({ status }: { status: DocumentQueryStatus }) => {
  const total = faker.number.int();
  const errors = faker.number.int();
  const successful = faker.number.int();

  if (status === "completed") {
    return {
      total: successful + errors,
      errors,
      status,
      successful,
    };
  } else if (status === "failed") {
    return {
      total,
      errors,
      status,
      successful,
    };
  }

  return {
    total: successful + errors + 1,
    errors,
    status,
    successful,
  };
};

export const createProgress = (progress: Progress): Progress => {
  const total = faker.number.int();
  const errors = faker.number.int();
  const successful = faker.number.int();

  return {
    total: progress?.total ?? total,
    errors: progress?.errors ?? errors,
    status: progress?.status ?? faker.helpers.arrayElement(documentQueryStatus),
    successful: progress?.successful ?? successful,
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
