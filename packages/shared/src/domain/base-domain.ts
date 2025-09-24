import { z } from "zod";

export const baseDomainCreateSchema = z.object({
  id: z.string(),
});
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface BaseDomainCreate extends z.infer<typeof baseDomainCreateSchema> {}

export const baseDomainNoIdSchema = z.object({
  createdAt: z.date(),
  updatedAt: z.date(),
});
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface BaseDomainNoId extends z.infer<typeof baseDomainNoIdSchema> {}

export const baseDomainSchema = z
  .object({
    eTag: z.string(),
  })
  .and(baseDomainCreateSchema)
  .and(baseDomainNoIdSchema);
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface BaseDomain extends z.infer<typeof baseDomainSchema> {}

export const baseDomainSoftDeleteSchema = z
  .object({
    deletedAt: z.date().optional(),
  })
  .and(baseDomainSchema);
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface BaseDomainSoftDelete extends z.infer<typeof baseDomainSoftDeleteSchema> {}
