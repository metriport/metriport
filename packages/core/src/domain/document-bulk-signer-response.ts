import { z } from "zod";

export type DocumentBulkSignerLambdaResponse = {
  id: string;
  fileName: string;
  description?: string;
  status?: string;
  indexed?: string; // ISO-8601
  mimeType?: string;
  size?: number; // bytes
  type?: CodeableConcept;
  url: string;
};

type Coding = {
  system?: string;
  code?: string;
  display?: string;
};

type CodeableConcept = {
  coding?: Coding[];
  text?: string;
};

export const DocumentBulkSignerLambdaResponseSchema = z.object({
  id: z.string(),
  fileName: z.string(),
  description: z.string().optional(),
  mimeType: z.string().optional(),
  size: z.number().optional(),
  url: z.string(),
  status: z.string().optional(),
  indexed: z.string().optional(),
  type: z
    .object({
      coding: z
        .array(
          z.object({
            system: z.string().optional(),
            code: z.string().optional(),
            display: z.string().optional(),
          })
        )
        .optional(),
      text: z.string().optional(),
    })
    .optional(),
});

export const DocumentBulkSignerLambdaResponseArraySchema = z.array(
  DocumentBulkSignerLambdaResponseSchema
);
