import { z } from "zod";

export type DocumentReferenceWithURL = {
  id: string;
  fileName: string;
  description?: string | undefined;
  status?: string | undefined;
  indexed?: string | undefined; // ISO-8601
  mimeType?: string | undefined;
  size?: number | undefined; // bytes
  type?: CodeableConcept | undefined;
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

export const documentReferenceWithURLSchema = z.object({
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

export const documentReferenceWithURLArraySchema = z.array(documentReferenceWithURLSchema);
