import { uuidv7 } from "@metriport/core/util/uuid-v7";
import { Request, RequestCreate, RequestMetadata } from "../../../domain/medical/request";
import { RequestModel } from "../../../models/medical/request";
import { getFacilityOrFail } from "../facility/get-facility";
import { getPatientOrFail } from "../patient/get-patient";

export type RequestCreateCmd = {
  cxId: string;
  facilityId: string;
  patientId: string;
  metadata?: RequestMetadata;
};

export const createRequest = async (request: RequestCreateCmd): Promise<Request> => {
  const { cxId, facilityId, patientId, metadata } = request;

  // validate facility and patient exist and cx has access to them
  await getFacilityOrFail({ cxId, id: facilityId });
  await getPatientOrFail({ cxId, id: patientId });

  const requestCreate: RequestCreate = {
    id: uuidv7(),
    cxId,
    facilityIds: [facilityId],
    patientId,
    metadata,
  };

  return await RequestModel.create(requestCreate);
};
