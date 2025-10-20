import { z } from "zod";

export const cxClientKeyAndSecretMapSecretSchema = z.record(z.string(), z.string());
export const cxApiKeyMapSecretSchema = z.record(z.string(), z.string());
