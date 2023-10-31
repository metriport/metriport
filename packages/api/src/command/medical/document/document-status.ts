import { getPatientOrFail } from "../patient/get-patient";
import { getRequestOrFail } from "../request/get-request";

export const areDocumentsProcessing = async ({
  id,
  cxId,
}: {
  id: string;
  cxId: string;
}): Promise<boolean> => {
  const patient = await getPatientOrFail({ id, cxId });

  return (
    patient.data.documentQueryProgress?.download?.status === "processing" ||
    patient.data.documentQueryProgress?.convert?.status === "processing"
  );
};

export const areDocumentsProcessingRequest = async ({
  id,
  cxId,
}: {
  id: string;
  cxId: string;
}): Promise<boolean> => {
  const request = await getRequestOrFail({ id, cxId });

  return (
    request.documentQueryProgress?.download?.status === "processing" ||
    request.documentQueryProgress?.convert?.status === "processing"
  );
};
