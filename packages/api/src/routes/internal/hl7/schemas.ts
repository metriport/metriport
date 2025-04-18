import { z } from "zod";

/**
 * Schema for validating S3 presigned URLs.
 * Only accepts URLs from S3.
 */
export const presignedUrlSchema = z
  .string()
  .url()
  .refine(
    url => {
      try {
        const urlObj = new URL(url);
        return urlObj.hostname.includes("s3");
      } catch {
        return false;
      }
    },
    { message: "URL must be a valid S3 url" }
  );
