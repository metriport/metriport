import { z } from "zod";

export const ISO_DATE_REGEX = /\d{4}-[01]\d-[0-3]\d/;

export const isoDateSchema = z.string().regex(ISO_DATE_REGEX, "date must be a valid ISO date");
