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
  xcpdPatientId: {
    id: string;
    system: string;
  };
  patientResourceId?: string;
  gateway: {
    homeCommunityId: string;
    url: string;
  };
  classCode?: Code[];
  practiceSettingCode?: Code[];
  facilityTypeCode?: Code[];
  documentCreationDate?: DateRange;
  serviceDate?: DateRange;
};
