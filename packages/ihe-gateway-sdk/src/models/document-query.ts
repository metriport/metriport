import { BaseRequest, baseResponseSchema, documentReference } from "./shared";
import { z } from "zod";

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

export const documentQueryResponseSchema = baseResponseSchema.extend({
  documentReference: z.array(documentReference).nullish(),
  gateway: z.object({ homeCommunityId: z.string(), url: z.string() }),
});

export type DocumentQueryResponse = z.infer<typeof documentQueryResponseSchema>;
