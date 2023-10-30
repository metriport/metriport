import { validConversionTypes } from "@metriport/core/domain/conversion/cda-to-html-pdf";
import { z } from "zod";

export const docConversionTypeSchema = z.enum(validConversionTypes);

export const docFileNameSchema = z.string();
