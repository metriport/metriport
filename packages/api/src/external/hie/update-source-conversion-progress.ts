import { Progress } from "@metriport/core/domain/document-query";
import { Patient } from "@metriport/core/domain/patient";
import { MedicalDataSource } from "@metriport/core/external/index";
import { tallyDocQueryProgress, ConvertResult } from "../../domain/medical/conversion-progress";

export const updateSourceConversionProgress = ({
  patient,
  convertResult,
  source,
}: {
  patient: Pick<Patient, "id" | "cxId">;
  convertResult: ConvertResult;
  source: MedicalDataSource;
} & {
  patient: Pick<Patient, "data" | "id">;
}): Progress | undefined => {
  const patientExternalData = patient.data.externalData ?? {};
  const sourceData = patientExternalData[source];
  const docQueryProgress = sourceData?.documentQueryProgress ?? {};

  const talliedDocQueryProgress = tallyDocQueryProgress(docQueryProgress, convertResult);

  return talliedDocQueryProgress.convert;
};
