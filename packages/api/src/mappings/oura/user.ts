import { User as MetriportUser } from "@metriport/api-sdk";
import { z } from "zod";
import { PROVIDER_OURA } from "../../shared/constants";

import { Util } from "../../shared/util";

export const mapToUser = (ouraPersonalInfo: OuraPersonalInfo, date: string): MetriportUser => {
  return {
    metadata: { date: date, source: PROVIDER_OURA },
    ...Util.addDataToObject("age", ouraPersonalInfo.age),
    ...Util.addDataToObject("email", ouraPersonalInfo.email),
    ...Util.addDataToObject("sex", ouraPersonalInfo.biological_sex),
  };
};

// Data retrieved from https://cloud.ouraring.com/v2/docs#tag/Personal-Info
export const ouraPersonalInfoResponse = z.object({
  age: z.number().nullable().optional(),
  weight: z.number().nullable().optional(),
  height: z.number().nullable().optional(),
  biological_sex: z.enum(["male", "female"]).nullable().optional(),
  email: z.string().nullable().optional(),
});

export type OuraPersonalInfo = z.infer<typeof ouraPersonalInfoResponse>;
