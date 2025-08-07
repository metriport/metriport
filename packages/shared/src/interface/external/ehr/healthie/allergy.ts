import { z } from "zod";

export const allergySchema = z.object({
  id: z.string(),
  category: z.enum(["allergy", "sensitivity", "preference", "intolerance", "ccda"]),
  category_type: z
    .enum(["drug", "food", "environmental", "pet", "latex", "like", "dislike"])
    .nullable(),
  name: z.string().nullable(),
  status: z.enum(["active", "inactive", "resolved"]).nullable(),
  onset_date: z.string().nullable(),
  reaction: z.string().nullable(),
  severity: z.enum(["mild", "moderate", "severe", "unknown"]).nullable(),
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
