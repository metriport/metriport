import { getPatientOrFail } from "../patient/get-patient";

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
