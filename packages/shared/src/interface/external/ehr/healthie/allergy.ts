import { z } from "zod";

export const allergySchema = z.object({
  id: z.string(),
  name: z.string(),
  onset_date: z.string(),
  status: z.enum(["active", "inactive", "resolved"]),
  category: z.enum(["allergy", "sensitivity", "preference", "intolerance", "ccda"]),
  category_type: z
    .enum(["drug", "food", "environmental", "pet", "latex", "like", "dislike"])
    .nullable(),
  reaction: z.string(),
  severity: z.enum(["mild", "moderate", "severe", "unknown"]),
});
export type Allergy = z.infer<typeof allergySchema>;

export const allergiesGraphqlSchema = z.object({
  data: z.object({
    user: z.object({
      allergy_sensitivities: allergySchema.array(),
    }),
  }),
});
export type AllergiesGraphql = z.infer<typeof allergiesGraphqlSchema>;
