import { z } from "zod";

export const numericValueSchema = z.preprocess(input => {
  if (typeof input === "string") {
    return parseInt(input);
  }
  return input;
}, z.number());
