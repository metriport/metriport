import { MedicalDataSource } from "@metriport/core/external/index";

export type SidechainFHIRConverterRequest = {
  cxId: string;
  patientId: string;
  documentId: string;
  payload: string;
  requestId?: string;
  source?: MedicalDataSource;
};

export interface SidechainFHIRConverterConnector {
  requestConvert(req: SidechainFHIRConverterRequest): Promise<void>;
}
