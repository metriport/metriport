import { zodToLowerCase } from "@metriport/shared";
import { z } from "zod";

export enum CertificatePurpose {
  Signing = "signing",
  Authentication = "authentication",
}
export const certificatePurposeSchema = z
  .string()
  .transform(zodToLowerCase)
  .pipe(z.nativeEnum(CertificatePurpose));

export const certificateSchema = z.object({
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  expirationDate: z.string().optional().nullable(),
  thumbprint: z.string().optional().nullable(),
  content: z.string().optional().nullable(),
  purpose: certificatePurposeSchema,
});

export type Certificate = z.infer<typeof certificateSchema>;

export type CertificateParam = {
  Certificates: Certificate[];
};

export const certificateRespSchema = z.object({
  certificates: z.array(certificateSchema),
});

export type CertificateResp = z.infer<typeof certificateRespSchema>;
