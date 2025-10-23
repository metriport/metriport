import { z } from "zod";

const contactAttributesSchema = z.object({
  type: z.literal("Contact"),
  url: z.string(),
});

const accountAttributesSchema = z.object({
  type: z.literal("Account"),
  url: z.string(),
});

const attributesSchema = z.union([contactAttributesSchema, accountAttributesSchema]);

/**
 * Schema for Contact object
 */
export const contactPatientSchema = z.object({
  attributes: contactAttributesSchema,
  Id: z.string(),
  FirstName: z.string().nullable(),
  LastName: z.string().nullable(),
  MailingStreet: z.string().nullable(),
  MailingCity: z.string().nullable(),
  MailingState: z.string().nullable(),
  MailingPostalCode: z.string().nullable(),
  MailingCountry: z.string().nullable(),
  Phone: z.string().nullable(),
  MobilePhone: z.string().nullable(),
  OtherPhone: z.string().nullable(),
  Email: z.string().nullable(),
  GenderIdentity: z.string().nullable(),
  Birthdate: z.string().nullable(),
});

/**
 * Schema for Account object (PersonAccount)
 */
export const accountPatientSchema = z.object({
  attributes: accountAttributesSchema,
  Id: z.string(),
  FirstName: z.string().nullable(),
  LastName: z.string().nullable(),
  BillingStreet: z.string().nullable(),
  BillingCity: z.string().nullable(),
  BillingState: z.string().nullable(),
  BillingPostalCode: z.string().nullable(),
  BillingCountry: z.string().nullable(),
  Phone: z.string().nullable(),
  PersonMobilePhone: z.string().nullable(),
  PersonOtherPhone: z.string().nullable(),
  PersonEmail: z.string().nullable(),
  GenderIdentity__c: z.string().nullable(),
  Birth_Date__c: z.string().nullable(),
});

/**
 * Generic patient schema that can be either Contact or Account
 * Uses passthrough to allow additional fields beyond the defined ones
 */
export const genericPatientSchema = z
  .object({
    attributes: attributesSchema,
    Id: z.string(),
  })
  .passthrough();

/**
 * Legacy schema for backward compatibility - kept for existing code
 * @deprecated Use normalized patient data instead
 */
export const patientSchema = contactPatientSchema;
export type Patient = z.infer<typeof patientSchema>;

export type ContactPatient = z.infer<typeof contactPatientSchema>;
export type AccountPatient = z.infer<typeof accountPatientSchema>;
export type GenericPatient = z.infer<typeof genericPatientSchema>;

export const patientSOQLSchema = z.object({
  totalSize: z.number(),
  done: z.boolean(),
  records: z.array(genericPatientSchema),
});
export type PatientSOQL = z.infer<typeof patientSOQLSchema>;
