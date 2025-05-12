export type ConversionResult = {
  cxId: string;
  patientId: string;
  status: "success" | "failed";
  details?: string | undefined;
  jobId?: string | undefined;
  /** The MedicalDataSource, or HIE name */
  source?: string;
};

export type ConversionResultWithCount = ConversionResult & {
  count?: number;
};

export interface ConversionResultHandler {
  notifyApi(params: ConversionResult, log?: typeof console.log): Promise<void>;
}
