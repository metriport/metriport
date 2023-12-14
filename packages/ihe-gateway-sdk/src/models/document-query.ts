import { BaseRequest } from "./shared";

export type Code = {
  system: string;
  code: string;
};

export type DateRange = {
  dateFrom: string;
  dateTo: string;
};

export type DocumentQueryRequest = BaseRequest & {
  xcaHomeCommunityId: string;
  xcpdPatientId: {
    id: string;
    system: string;
  };
  patientId?: string;
  xcaGateway: string;
  classCode?: Code[];
  practiceSettingCode?: Code[];
  facilityTypeCode?: Code[];
  documentCreationDate?: DateRange;
  serviceDate?: DateRange;
};
