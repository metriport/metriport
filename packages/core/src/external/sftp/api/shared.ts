import { MetriportError } from "@metriport/shared";
import { AxiosResponse } from "axios";
import { z } from "zod";

export function validateAndLogResponse<T>({
  url,
  response,
  schema,
  debug,
}: {
  url: string;
  response: AxiosResponse;
  schema: z.ZodSchema<T>;
  debug: typeof console.log;
}): T {
  if (!response.data) throw new MetriportError(`No body returned from ${url}`);
  debug(`${url} resp: `, () => JSON.stringify(response.data));
  return schema.parse(response.data);
}

export const patientSchema = z.object({
  id: z.string(),
  facilityIds: z.array(z.string()),
  firstName: z.string(),
  lastName: z.string(),
  dob: z.string(),
  genderAtBirth: z.enum(["M", "F", "O", "U"]),
  address: z.array(
    z.object({
      addressLine1: z.string().optional(),
      addressLine2: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      zip: z.string(),
    })
  ),
});

export type GetPatientResponse = z.infer<typeof patientSchema>;

export const getCustomerResponseSchema = z.object({
  cxId: z.string(),
  facilities: z.array(
    z.object({
      id: z.string(),
      oid: z.string(),
      name: z.string(),
      npi: z.string(),
    })
  ),
});

export type GetCustomerResponse = z.infer<typeof getCustomerResponseSchema>;
export type FacilityResponse = GetCustomerResponse["facilities"][number];

export const getPatientIdsResponseSchema = z.object({
  patientIds: z.array(z.string()),
});

export type GetPatientIdsResponse = z.infer<typeof getPatientIdsResponseSchema>;
