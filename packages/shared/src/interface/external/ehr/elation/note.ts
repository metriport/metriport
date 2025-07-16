import { z } from "zod";

export const createdNonVisitNoteSchema = z.object({
  id: z.coerce.string(),
});
export type CreatedNonVisitNote = z.infer<typeof createdNonVisitNoteSchema>;
