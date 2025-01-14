import { z } from "zod";

export const departmentSchema = z.object({
  departmentid: z.string(),
});
export type Department = z.infer<typeof departmentSchema>;
export const departmentsGetResponseSchema = z.object({
  departments: departmentSchema.array(),
});
