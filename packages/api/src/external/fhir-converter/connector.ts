export enum FHIRConverterSourceDataType {
  cda = "cda",
  hl7v2 = "hl7v2",
}

export type FHIRConverterRequest = {
  cxId: string;
  patientId: string;
  documentId: string;
  sourceType: FHIRConverterSourceDataType;
  payload: string;
  template: string;
  unusedSegments: string;
  invalidAccess: string;
};

export interface FHIRConverterConnector {
  requestConvert(req: FHIRConverterRequest): Promise<void>;
}
