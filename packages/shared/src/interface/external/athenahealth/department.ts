import { z } from "zod";

export const departmentSchema = z.object({
  departmentid: z.string(),
});
export type Department = z.infer<typeof departmentSchema>;
export const departmentsSchema = z.object({
  departments: departmentSchema.array(),
});
export type Departments = z.infer<typeof departmentsSchema>;
