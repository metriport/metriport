import { z } from "zod";

const attributesSchema = z.object({
  type: z.literal("Contact"),
  url: z.string(),
});

export const patientSchema = z.object({
  attributes: attributesSchema,
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

export type Patient = z.infer<typeof patientSchema>;

export const patientSOQLSchema = z.object({
  totalSize: z.number(),
  done: z.boolean(),
  records: z.array(patientSchema),
});
export type PatientSOQL = z.infer<typeof patientSOQLSchema>;
