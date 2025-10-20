import { z } from "zod";

export const ccdaDocumentSchema = z.object({
  id: z.coerce.string(),
  base64_ccda: z.string(),
});
export type CcdaDocument = z.infer<typeof ccdaDocumentSchema>;
