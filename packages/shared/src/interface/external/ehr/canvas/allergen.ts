import { z } from "zod";

export const allergenResourceSchema = z.intersection(
  z.object({
    id: z.string(),
    resourceType: z.literal("Allergen"),
  }),
  z.record(z.string(), z.any())
);
export type AllergenResource = z.infer<typeof allergenResourceSchema>;
