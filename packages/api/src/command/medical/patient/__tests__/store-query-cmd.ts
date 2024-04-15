import * as uuidv7_file from "@metriport/core/util/uuid-v7";
import { DocumentQueryProgress } from "@metriport/core/domain/document-query";
import { PatientDiscovery, QueryProgress } from "@metriport/core/domain/query-status";
import { makeProgress } from "../../../../domain/medical/__tests__/document-query";
import { StoreQueryParams } from "../query-init";
import { makePatientData } from "../../../../domain/medical/__tests__/patient";
import { makePatientModel } from "../../../../models/medical/__tests__/patient";

export const requestId = uuidv7_file.uuidv4();
export const patient = { id: "patient-id", cxId: "cx-id" };

export const pdParams: StoreQueryParams = {
  id: patient.id,
  cxId: patient.cxId,
  cmd: { patientDiscovery: { requestId, startedAt: new Date() } },
};

export const dqParams: StoreQueryParams = {
  id: patient.id,
  cxId: patient.cxId,
  cmd: {
    documentQueryProgress: {
      requestId,
      startedAt: new Date(),
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

export const patientDiscovery: PatientDiscovery = {
  requestId,
  startedAt: new Date(),
};

export const consolidatedQuery: QueryProgress = {
  status: "processing",
  startedAt: new Date(),
};

export const mockedPatientAllProgresses = makePatientModel({
  data: makePatientData({
    documentQueryProgress,
    patientDiscovery,
    consolidatedQuery,
  }),
});
