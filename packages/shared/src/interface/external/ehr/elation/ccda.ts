import { z } from "zod";

export const ccdaDocumentSchema = z.object({
  ccda: z.string(),
});
export type CcdaDocument = z.infer<typeof ccdaDocumentSchema>;
