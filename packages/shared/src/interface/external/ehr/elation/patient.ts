import { z } from "zod";

const address = z.object({
  state: z.string().nullable(),
  address_line1: z.string().nullable(),
  address_line2: z.string().nullable(),
  city: z.string().nullable(),
  zip: z.string().nullable(),
});

const phone = z.object({
  phone: z.string(),
});

const email = z.object({
  email: z.string(),
});

export const patientSchema = z.object({
  first_name: z.string().nullable(),
  last_name: z.string().nullable(),
  middle_name: z.string().nullable(),
  sex: z.string(),
  address: address.nullable(),
  dob: z.string(),
  phones: phone.array().nullable(),
  emails: email.array().nullable(),
  ssn: z.string().nullable(),
});

export type Patient = z.infer<typeof patientSchema>;

const metadata = z.object({
  object_id: z.string(),
  object_web_link: z.string(),
});

export type Metadata = z.infer<typeof metadata>;
