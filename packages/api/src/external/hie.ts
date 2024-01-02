import { Progress, DocumentQueryProgress } from "../domain/medical/document-query";
import { MedicalDataSource } from ".";
import { PatientExternalData } from "../domain/medical/patient";
import { PatientModel } from "../models/medical/patient";
import { PatientDataCommonwell } from "./commonwell/patient-shared";
import { PatientDataCarequality } from "./carequality/patient-shared";
import { setDocQueryProgress } from "../command/medical/patient/append-doc-query-progress";
import { getCWData } from "./commonwell/patient";
import { getCQData } from "./carequality/patient";

type HIEPatientData = PatientDataCommonwell | PatientDataCarequality;

export function setExternalData(
  reset: boolean | undefined,
  patient: PatientModel,
  downloadProgress: Progress | undefined | null,
  convertProgress: Progress | undefined | null,
  source: MedicalDataSource,
  convertibleDownloadErrors?: number,
  increaseCountConvertible?: number
): PatientExternalData {
  const externalData = patient.data.externalData ?? {};

  if (reset) {
    return {
      ...externalData,
      COMMONWELL: {
        ...externalData.COMMONWELL,
        documentQueryProgress: {},
      },
      CAREQUALITY: {
        ...externalData.CAREQUALITY,
        documentQueryProgress: {},
      },
    };
  }

  const sourceData = externalData[source] as HIEPatientData;

  const docQueryProgress = setDocQueryProgress(
    sourceData?.documentQueryProgress ?? {},
    downloadProgress,
    convertProgress,
    convertibleDownloadErrors,
    increaseCountConvertible
  );

  externalData[source] = {
    ...externalData[source],
    documentQueryProgress: docQueryProgress,
  };

  return externalData;
}

export function setDocQueryProgressWithExternal(
  externalData: PatientExternalData
): DocumentQueryProgress[] {
  const cwExternalData = getCWData(externalData);
  const cqExternalData = getCQData(externalData);

  const cwProgress = cwExternalData?.documentQueryProgress ?? {};
  const cqProgress = cqExternalData?.documentQueryProgress ?? {};

  const progresses: DocumentQueryProgress[] = [cwProgress, cqProgress];

  return progresses;
}
