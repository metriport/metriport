import z from "zod";

export const clinicalNoteDocumentReferenceSchema = z.object({
  resourceType: z.literal("DocumentReference"),
  id: z.string(),
  status: z.string(),
  date: z.string().optional(),
  context: z
    .object({
      encounter: z.object({ reference: z.string().optional() }).array().optional(),
    })
    .optional(),
  content: z
    .object({
      attachment: z.object({ contentType: z.string().optional(), url: z.string() }),
    })
    .array()
    .min(1),
});
export type ClinicalNoteDocumentReference = z.infer<typeof clinicalNoteDocumentReferenceSchema>;

export const clinicalNoteDocumentReferenceBundleSchema = z.object({
  resourceType: z.literal("Bundle"),
  link: z.object({ relation: z.string(), url: z.string() }).array().optional(),
  entry: z.object({ resource: clinicalNoteDocumentReferenceSchema }).array().optional(),
});
export type ClinicalNoteDocumentReferenceBundle = z.infer<
  typeof clinicalNoteDocumentReferenceBundleSchema
>;
