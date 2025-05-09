import z from "zod";

export const noteSchema = z.object({
  permalink: z.string(),
  noteKey: z.string(),
  title: z.string(),
  datetimeOfService: z.string(),
  titleDisplay: z.string(),
  currentState: z.string(),
  patientKey: z.string(),
  providerKey: z.string(),
  practiceLocationKey: z.string(),
  noteTypeName: z.string(),
  noteTypeSystem: z.string(),
  noteTypeCoding: z.string(),
});
export type Note = z.infer<typeof noteSchema>;

export const noteListResponseSchema = z.object({
  results: noteSchema.array(),
  next: z.string().nullable(),
});
export type NoteListResponse = z.infer<typeof noteListResponseSchema>;
