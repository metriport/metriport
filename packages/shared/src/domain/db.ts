import { z } from "zod";
import { Dialect } from "sequelize";

export const dbCredsSchema = z.object({
  dbname: z.string(),
  username: z.string(),
  password: z.string(),
  host: z.string(),
  port: z.number(),
  engine: z.custom<Dialect>(),
});

export const dbCredsSchemaReadOnly = dbCredsSchema.omit({
  dbname: true,
  username: true,
  password: true,
  engine: true,
});

export type DbCreds = z.infer<typeof dbCredsSchema>;
export type DbCredsReadOnly = z.infer<typeof dbCredsSchemaReadOnly>;

export const dbPoolSettingsSchema = z.object({
  max: z.number(),
  min: z.number(),
  acquire: z.number(),
  idle: z.number(),
});
export type DbPoolSettings = z.infer<typeof dbPoolSettingsSchema>;
