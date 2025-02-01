import z from "zod";

export const catchUpOrBackFillSchema = z.enum(["catchUp", "backFill"]);
export type CatchUpOrBackFill = z.infer<typeof catchUpOrBackFillSchema>;
