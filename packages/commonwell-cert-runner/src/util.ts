import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ above all other imports
import { faker } from "@faker-js/faker";
import { sleep } from "@metriport/shared";
import { decodeCwPatientId, getPatientIdTrailingSlash } from "@metriport/commonwell-sdk";
import { PatientCollectionItem } from "@metriport/commonwell-sdk/models/patient";

export function getEnv(name: string): string | undefined {
  return process.env[name];
}
export function getEnvOrFail(name: string): string {
  const value = getEnv(name);
  if (!value || value.trim().length < 1) throw new Error(`Missing env var ${name}`);
  return value;
}

export function getCertificateContent(cert: string): string | undefined {
  const regex = /-+BEGIN CERTIFICATE-+([\s\S]+?)-+END CERTIFICATE-+/i;
  const matches = cert.match(regex);
  const content = matches && matches[1];
  if (content) {
    return content.replace(/\r\n|\n|\r/gm, "");
  }
  return undefined;
}

export function filterTruthy<T>(o: T | undefined | null): T | [] {
  return o ? o : [];
}

export function firstElementOrFail<T>(arr?: T[] | undefined, fieldName?: string): T {
  if (arr && arr.length > 0) return arr[0];
  throw new Error(`No first ${fieldName ? fieldName : "element"} on array`);
}

export function makeShortName(): string {
  let shortName = " ";
  while (shortName.includes(" ")) {
    shortName = faker.helpers.fake("{{word.adjective}}-{{color.human}}-{{animal.type()}}");
  }
  return shortName;
}

export function getMetriportPatientIdOrFail(
  patient: PatientCollectionItem | undefined | null,
  context: string
): string {
  if (!patient) throw new Error("Missing patient");
  const patientIdRaw = getPatientIdTrailingSlash(patient);
  if (!patientIdRaw) throw new Error(`No patientId on response from ${context}`);
  const patientId = decodeCwPatientId(patientIdRaw).value;
  if (!patientId) {
    throw new Error(`PatientId could not be decoded from ${patientIdRaw}`);
  }
  console.log(`>>> [${context}] Patient ID: ${patientId}`);
  return patientId;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function logError(error: any) {
  console.error(`Error (${error.response?.status}): ${error.message}`);
  if (error.response?.data) {
    console.error(JSON.stringify(error.response.data, null, 2));
  }
}

export function waitSeconds(seconds: number) {
  console.log(`waiting ${seconds} seconds...`);
  return sleep(seconds * 1_000);
}
