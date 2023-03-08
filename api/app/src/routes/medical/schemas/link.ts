import { z } from "zod";
import { patientUpdateSchema } from "./patient";
import { LinkSource } from "../../../models/medical/link";

export const linkSourceSchema = z.enum(Object.keys(LinkSource) as [string, ...string[]]);

export const linkSchema = z.object({
  id: z.string().optional().nullable(), // id of the actual link, returned empty from the API if this is a potential link
  entityId: z.string(), // the entity the link is referencing, in case of CW this will be the person ID
  potential: z.boolean(),
  source: linkSourceSchema, // will be important soon, want to add this ahead of time
  patient: patientUpdateSchema, // can be patient or person in the case of CW
});
export type Link = z.infer<typeof linkSchema>;

export type PatientLinks = {
  potentialLinks: Link[];
  currentLinks: Link[];
};
