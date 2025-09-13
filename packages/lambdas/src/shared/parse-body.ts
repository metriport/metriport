import { MetriportError } from "@metriport/shared";
import { z } from "zod";

//eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseCxId(bodyAsJson: any): string {
  const cxIdRaw = bodyAsJson.cxId;
  if (!cxIdRaw) throw new Error(`Missing cxId`);
  if (typeof cxIdRaw !== "string") throw new Error(`Invalid cxId`);
  return cxIdRaw;
}

//eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parsePatientId(bodyAsJson: any): string {
  const patientIdRaw = bodyAsJson.patientId;
  if (!patientIdRaw) throw new Error(`Missing patientId`);
  if (typeof patientIdRaw !== "string") throw new Error(`Invalid patientId`);
  return patientIdRaw;
}

//eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseFacilityId(bodyAsJson: any) {
  const facilityIdRaw = bodyAsJson.facilityId;
  if (!facilityIdRaw) throw new Error(`Missing facilityId`);
  if (typeof facilityIdRaw !== "string") throw new Error(`Invalid facilityId`);
  return facilityIdRaw;
}

//eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseJobId(bodyAsJson: any): string {
  const jobIdRaw = bodyAsJson.jobId;
  if (!jobIdRaw) throw new Error(`Missing jobId`);
  if (typeof jobIdRaw !== "string") throw new Error(`Invalid jobId`);
  return jobIdRaw;
}

//eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseCxIdAndJob(bodyAsJson: any) {
  const cxIdRaw = parseCxId(bodyAsJson);
  const jobIdRaw = parseJobId(bodyAsJson);
  return { cxIdRaw, jobIdRaw };
}

export function parseBody<T>(schema: z.Schema<T>, body?: unknown): T {
  if (!body) throw new MetriportError(`Missing message body`);

  const bodyString = typeof body === "string" ? (body as string) : undefined;
  if (!bodyString) throw new MetriportError(`Invalid body`);

  const bodyAsJson = JSON.parse(bodyString);

  return schema.parse(bodyAsJson);
}
