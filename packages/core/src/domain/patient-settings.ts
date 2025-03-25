import { z } from "zod";
import { BaseDomain, BaseDomainCreate } from "./base-domain";
import { PatientData } from "./patient";

export type Subscriptions = {
  adt?: boolean;
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

export type Hl7v2Subscriber = {
  id: string;
  cxId: string;
  ssn?: string;
  driversLicense?: string;
  phone?: string;
  email?: string;
} & Pick<PatientData, "firstName" | "lastName" | "dob" | "address" | "genderAtBirth">;

export const validHl7v2Subscriptions = ["adt"] as const;
export const hl7v2SubscriptionSchema = z.enum(validHl7v2Subscriptions);
export type Hl7v2Subscription = z.infer<typeof hl7v2SubscriptionSchema>;

export const hl7v2SubscriptionRequestSchema = z.object({
  subscriptions: z.array(z.string()).transform(subs => {
    const validSubs: Hl7v2Subscription[] = [];
    const invalidSubs: string[] = [];

    subs.forEach(sub => {
      const result = hl7v2SubscriptionSchema.safeParse(sub.toLowerCase());
      if (result.success) {
        validSubs.push(result.data);
      } else {
        invalidSubs.push(sub);
      }
    });

    return { validSubscriptions: validSubs, invalidSubscriptions: invalidSubs };
  }),
});
