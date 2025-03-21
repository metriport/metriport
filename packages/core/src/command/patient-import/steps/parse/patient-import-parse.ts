export type PatientImportParseRequest = {
  cxId: string;
  jobId: string;
  forceStatusUpdate?: boolean | undefined;
};

export interface PatientImportParse {
  processJobParse(request: PatientImportParseRequest): Promise<void>;
}
