import * as uuidv7_file from "@metriport/core/util/uuid-v7";
import { DocumentQueryProgress } from "@metriport/core/domain/document-query";
import { QueryProgress } from "@metriport/core/domain/query-status";
import { makeProgress } from "../../../../domain/medical/__tests__/document-query";
import { StoreQueryParams } from "../query-init";
import { makePatientData } from "../../../../domain/medical/__tests__/patient";
import { makePatientModel } from "../../../../models/medical/__tests__/patient";

export const requestId = uuidv7_file.uuidv4();
export const patient = { id: uuidv7_file.uuidv7(), cxId: uuidv7_file.uuidv7() };

export const dqParams: StoreQueryParams = {
  id: patient.id,
  cxId: patient.cxId,
  cmd: {
    documentQueryProgress: {
      requestId,
      download: makeProgress(),
    },
  },
};

export const cqParams: StoreQueryParams = {
  id: patient.id,
  cxId: patient.cxId,
  cmd: {
    consolidatedQuery: {
      status: "processing",
      startedAt: new Date(),
    },
  },
};

export const documentQueryProgress: DocumentQueryProgress = {
  requestId,
  startedAt: new Date(),
  download: makeProgress(),
  convert: makeProgress(),
};

export const consolidatedQuery: QueryProgress = {
  status: "processing",
  startedAt: new Date(),
};

export const mockedPatientAllProgresses = makePatientModel({
  data: makePatientData({
    documentQueryProgress,
    consolidatedQuery,
  }),
});
