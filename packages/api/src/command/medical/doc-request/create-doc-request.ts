import { uuidv7 } from "@metriport/core/util/uuid-v7";
import {
  DocRequest,
  DocRequestCreate,
  DocRequestMetadata,
} from "../../../domain/medical/doc-request";
import { DocRequestModel } from "../../../models/medical/doc-request";
//import { getFacilityOrFail } from "../facility/get-facility";
import { getPatientOrFail } from "../patient/get-patient";
import { DocumentQueryProgress } from "../../../domain/medical/document-query";

export type DocRequestCreateCmd = {
  cxId: string;
  facilityId: string;
  patientId: string;
  metadata: DocRequestMetadata;
};

export const createDocRequest = async (docRequest: DocRequestCreateCmd): Promise<DocRequest> => {
  const { cxId, facilityId, patientId, metadata } = docRequest;

  // validate facility and patient exist and cx has access to them
  //await getFacilityOrFail({ cxId, id: facilityId });
  await getPatientOrFail({ cxId, id: patientId });

  const docQueryProgress: DocumentQueryProgress = {};

  const docRequestCreate: DocRequestCreate = {
    id: uuidv7(),
    cxId,
    facilityIds: [facilityId],
    patientId,
    metadata,
    documentQueryProgress: docQueryProgress,
  };

  return await DocRequestModel.create(docRequestCreate);
};
