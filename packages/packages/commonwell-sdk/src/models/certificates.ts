import { z } from "zod";
import { linkSchema } from "./link";

export enum CertificatePurpose {
  Signing = "Signing",
  Authentication = "Authentication",
}
export const certificatePurposeSchema = z.enum(
  Object.keys(CertificatePurpose) as [string, ...string[]]
);

export const certificateSchema = z.object({
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  expirationDate: z.string().optional().nullable(),
  thumbprint: z.string().optional().nullable(),
  content: z.string().optional().nullable(),
  purpose: certificatePurposeSchema,
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
