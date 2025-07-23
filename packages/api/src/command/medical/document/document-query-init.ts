import { DocumentQueryProgress, Progress } from "@metriport/core/domain/document-query";
import { Patient, PatientExternalData } from "@metriport/core/domain/patient";
import { PatientModel } from "../../../models/medical/patient";
import { executeOnDBTx } from "../../../models/transaction-wrapper";
import { getPatientModelOrFail } from "../patient/get-patient";

export type DocumentQueryProgressForQueryInit = Required<
  Pick<DocumentQueryProgress, "requestId" | "startedAt">
> &
  Pick<DocumentQueryProgress, "triggerConsolidated">;

export type StoreDocQueryInitialStateParams = {
  id: string;
  cxId: string;
  documentQueryProgress: DocumentQueryProgressForQueryInit;
  cxDocumentRequestMetadata?: unknown;
};

const initialDownloadProgress: Progress = {
  status: "processing" as const,
};

/**
 * Store the document query initial state in the patient model.
 * It will set the download progress to the default value and unset/reset the convert progress.
 *
 * @see initialDownloadProgress for the initial download progress.
 *
 * @param params - The parameters for the document query initial state.
 * @param params.id - The id of the patient.
 * @param params.cxId - The cx id of the patient.
 * @param params.documentQueryProgress - The document query progress.
 * @param params.cxDocumentRequestMetadata - The cx document request metadata.
 * @returns The updated patient.
 */
export async function storeDocumentQueryInitialState({
  id,
  cxId,
  documentQueryProgress,
  cxDocumentRequestMetadata,
}: StoreDocQueryInitialStateParams): Promise<Patient> {
  const patient = await executeOnDBTx(PatientModel.prototype, async transaction => {
    const patient = await getPatientModelOrFail({
      id,
      cxId,
      lock: true,
      transaction,
    });
    const patientData = patient.dataValues.data;

    const documentQueryProgressInitialState: DocumentQueryProgress = {
      ...documentQueryProgress,
      download: initialDownloadProgress,
      convert: undefined,
    };

    const externalDataWithResetDqProgress: PatientExternalData = {
      ...patientData.externalData,
      COMMONWELL: {
        ...patientData.externalData?.COMMONWELL,
        documentQueryProgress: documentQueryProgressInitialState,
      },
      CAREQUALITY: {
        ...patientData.externalData?.CAREQUALITY,
        documentQueryProgress: documentQueryProgressInitialState,
      },
    };

    return patient.update(
      {
        data: {
          ...patientData,
          documentQueryProgress: documentQueryProgressInitialState,
          externalData: externalDataWithResetDqProgress,
          cxDocumentRequestMetadata,
        },
      },
      { transaction }
    );
  });
  return patient.dataValues;
}
