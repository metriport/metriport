import {
  AdtSubscriptionRequest,
  adtSubscriptionRequestSchema,
  BulkPatientSettingsRequest,
  bulkPatientSettingsRequestSchema,
  PatientSettingsRequest,
  patientSettingsRequestSchema,
  queryMetaSchema,
} from "@metriport/shared";
import { z } from "zod";
import {
  getHieConfigDictionary,
  throwOnInvalidHieName,
} from "../external/hl7-notification/hie-config-dictionary";
import { out } from "../util/log";
import { BaseDomain, BaseDomainCreate } from "./base-domain";

const { log } = out("PatientSettings");

export type Subscriptions = {
  adt?: string[];
};

export type PatientSettingsData = {
  subscriptions?: Subscriptions;
};

export interface PatientSettingsCreate extends BaseDomainCreate {
  cxId: string;
  patientId: string;
  subscriptions?: Subscriptions;
}

export interface PatientSettings extends BaseDomain, PatientSettingsCreate {}

export const validHl7v2Subscriptions = ["adt"] as const;
export const hl7v2SubscriptionSchema = z.enum(validHl7v2Subscriptions);
export type Hl7v2Subscription = z.infer<typeof hl7v2SubscriptionSchema>;

export const hl7v2SubscribersQuerySchema = z
  .object({
    hieName: z.string(),
  })
  .and(queryMetaSchema);

export function parsePatientSettingsRequest(data: unknown): PatientSettingsRequest {
  if (getHieConfigDictionary()) {
    const result = patientSettingsRequestSchema.parse(data);
    result.settings.subscriptions?.adt?.forEach(throwOnInvalidHieName);
    return result;
  }
  log("parsePatientSettingsRequest - No HIE config dictionary found, skipping HIE name validation");
  return patientSettingsRequestSchema.parse(data);
}

export function parseBulkPatientSettingsRequest(data: unknown): BulkPatientSettingsRequest {
  if (getHieConfigDictionary()) {
    const result = bulkPatientSettingsRequestSchema.parse(data);
    result.settings.subscriptions?.adt?.forEach(throwOnInvalidHieName);
    return result;
  }
  log(
    "parseBulkPatientSettingsRequest - No HIE config dictionary found, skipping HIE name validation"
  );
  return bulkPatientSettingsRequestSchema.parse(data);
}

export function parseAdtSubscriptionRequest(data: unknown): AdtSubscriptionRequest {
  if (getHieConfigDictionary()) {
    const result = adtSubscriptionRequestSchema.parse(data);
    throwOnInvalidHieName(result.hieName);
    return result;
  }
  log("parseAdtSubscriptionRequest - No HIE config dictionary found, skipping HIE name validation");
  return adtSubscriptionRequestSchema.parse(data);
}
