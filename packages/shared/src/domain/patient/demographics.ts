import { z } from "zod";
import { createNonEmptryStringSchema } from "../../common/string";
import { dobSchema } from "../dob";
import { genderAtBirthSchema } from "../gender";
import { personalIdentifierSchema } from "../identifier";
import { addressSchema } from "../address";
import { contactSchema } from "../contact";

export const demographicsSchema = z.object({
  firstName: createNonEmptryStringSchema("firstName"),
  lastName: createNonEmptryStringSchema("lastName"),
  dob: dobSchema,
  genderAtBirth: genderAtBirthSchema,
  personalIdentifiers: z.array(personalIdentifierSchema).nullish(),
  address: z.array(addressSchema).nonempty(),
  contact: z.array(contactSchema).nullish(),
});
