import { z } from "zod";

export const npiStringSchema = z.string().regex(/^\d+$/, "NPI strings must consist of numbers");

export const oidStringSchema = z.string().regex(/^[0-9]+(\.[0-9]+)*$/, "OID string invalid");
