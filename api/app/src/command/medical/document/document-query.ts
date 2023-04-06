import { DocumentQueryStatus } from "../../../domain/medical/document-reference";
import { processAsyncError } from "../../../errors";
import { getDocuments as getDocumentsFromCW } from "../../../external/commonwell/document/document-query";
import { PatientDataCommonwell } from "../../../external/commonwell/patient-shared";
import { Patient } from "../../../models/medical/patient";
import { getPatientOrFail } from "../patient/get-patient";

// TODO: eventually we will have to update this to support multiple HIEs
export async function queryDocumentsAcrossHIEs({
  cxId,
  patientId,
  facilityId,
}: {
  cxId: string;
  patientId: string;
  facilityId: string;
}): Promise<DocumentQueryStatus> {
  const patient = await getPatientOrFail({ id: patientId, cxId });
  if (patient.data.documentQueryStatus === "processing") return "processing";

  const externalData = patient.data.externalData?.COMMONWELL;
  if (!externalData) return "completed";

  const cwData = externalData as PatientDataCommonwell;
  if (!cwData.patientId) return "completed";

  await updateDocQueryStatus({ patient, status: "processing" });

  // intentionally asynchronous, not waiting for the result
  getDocumentsFromCW({ patient, facilityId }).catch(
    processAsyncError(`doc.list.getDocumentsFromCW`)
  );

  return "processing";
}

export const updateDocQueryStatus = async ({
  patient,
  status,
}: {
  patient: Patient;
  status: DocumentQueryStatus;
}): Promise<Patient> => {
  const patientModel = await getPatientOrFail({ id: patient.id, cxId: patient.cxId });
  return patientModel.update({
    data: {
      ...patient.data,
      documentQueryStatus: status,
    },
  });
};
