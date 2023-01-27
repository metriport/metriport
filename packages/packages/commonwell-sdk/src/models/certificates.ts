import { z } from "zod";
import { linkSchema } from "./link";

export const certificateSchema = z.object({
  startDate: z.string(),
  endDate: z.string(),
  expirationDate: z.string(),
  thumbprint: z.string(),
  content: z.string().optional().nullable(),
  purpose: z.string(),
});

export type Certificate = z.infer<typeof certificateSchema>;

export const certificatesParamSchema = z.object({
  Certificates: z.array(certificateSchema),
});

export type CertificateParam = z.infer<typeof certificatesParamSchema>;

export const certificateRespSchema = z.object({
  certificates: z.array(certificateSchema),
  _links: z.object({ self: linkSchema.optional().nullable() }),
});

export type CertificateResp = z.infer<typeof certificateRespSchema>;
