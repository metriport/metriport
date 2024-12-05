import { z } from "zod";

const address = z.object({
  state: z.string(),
  address_line1: z.string(),
  address_line2: z.string(),
  city: z.string(),
  zip: z.string(),
});

const phone = z.object({
  phone: z.string(),
});

const email = z.object({
  email: z.string(),
});

export const patientResourceSchema = z.object({
  first_name: z.string(),
  last_name: z.string(),
  middle_name: z.string(),
  sex: z.string(),
  address,
  dob: z.string(),
  phones: phone.array(),
  emails: email.array(),
  ssn: z.string().nullable(),
});

export type PatientResource = z.infer<typeof patientResourceSchema>;

const metadata = z.object({
  object_id: z.string(),
  object_web_link: z.string(),
});

export type Metadata = z.infer<typeof metadata>;
