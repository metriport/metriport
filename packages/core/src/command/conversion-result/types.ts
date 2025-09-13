import { MedicalDataSource } from "../../external";

export type ConversionResult = {
  cxId: string;
  patientId: string;
  status: "success" | "failed";
  details?: string | undefined;
  jobId?: string | undefined;
  source: MedicalDataSource;
};

export type ConversionResultWithCount = ConversionResult & {
  count?: number;
};

export interface ConversionResultHandler {
  notifyApi(params: ConversionResult, log?: typeof console.log): Promise<void>;
}
