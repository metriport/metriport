import { BadRequestError, defaultOptionalStringSchema } from "@metriport/shared";
import { validateNPI } from "@metriport/shared/common/validate-npi";
import z from "zod";
import { addressStrictSchema } from "./address";

export enum FacilityType {
  initiatorAndResponder = "initiator_and_responder",
  initiatorOnly = "initiator_only",
}

export const facilityInternalDetailsSchema = z
  .object({
    id: z.string().optional(),
    nameInMetriport: z
      .string()
      .min(1)
      .transform(name => name.replace(/&/g, "and")),
    npi: z
      .string()
      .length(10)
      .refine(npi => validateNPI(npi), { message: "NPI is not valid" }),
    tin: defaultOptionalStringSchema,
    type: z.nativeEnum(FacilityType),
    principalOid: z.string().optional(),
    // CQ
    cqApproved: z.boolean().optional(),
    cqActive: z.boolean().optional(),
    // CW
    cwApproved: z.boolean().optional(),
    cwActive: z.boolean().optional(),
    // EHEX
    ehexApproved: z.boolean().optional(),
    ehexActive: z.boolean().optional(),
  })
  .merge(addressStrictSchema);
export type FacilityInternalDetails = z.infer<typeof facilityInternalDetailsSchema>;

export function validateDelegateFacility({
  type,
  principalOid,
  throwOnError = true,
}: {
  type: FacilityType;
  principalOid: string | null | undefined;
  throwOnError?: boolean;
}): boolean {
  if (type === FacilityType.initiatorOnly && !principalOid) {
    if (!throwOnError) return false;
    throw new BadRequestError("A delegate facility must have a principal OID");
  }

  return true;
}
