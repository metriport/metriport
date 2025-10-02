import { z } from "zod";

export const sftpConfigSchema = z.object({
  host: z.string().min(1, "Host is required"),
  port: z.union([
    z.number().int().positive("Port must be a positive integer"),
    z
      .string()
      .min(1, "Port is required")
      .transform(val => {
        const portNumber = parseInt(val, 10);
        if (isNaN(portNumber)) {
          throw new Error("Port must be a valid number");
        }
        return portNumber;
      }),
  ]),
  username: z.string().min(1, "Username is required"),
});

export type SftpConfig = z.infer<typeof sftpConfigSchema>;
