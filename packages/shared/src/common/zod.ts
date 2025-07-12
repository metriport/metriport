import { z } from "zod";

export const numericValue = z.preprocess(input => {
  if (typeof input === "string") {
    return parseInt(input);
  }
  return input;
}, z.number());
