import { EhrSource } from "@metriport/shared/interface/external/ehr/source";

export type GetAppointmentsRequest = {
  ehr: EhrSource;
  environment: string;
  method: string;
  tokenId?: string;
  cxId: string;
  practiceId: string;
  fromDate?: Date;
  toDate?: Date;
};

export interface EhrGetAppointmentsHandler {
  getAppointments<T>(request: GetAppointmentsRequest): Promise<T[]>;
}
