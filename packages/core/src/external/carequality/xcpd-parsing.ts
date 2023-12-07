import * as xml2js from "xml2js";
import { PatientData } from "../../domain/patient/patient-incoming-schema";
import { Address } from "@metriport/api-sdk/medical/models/common/address";

export function parseXmlString(xml: string): PatientData | null {
  xml = JSON.parse(`"${xml}"`);
  let patientData: PatientData | null = null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  xml2js.parseString(xml, (err: Error | null, result: any) => {
    if (err) {
      console.error(err);
      return;
    }
    try {
      const parameterList =
        result["s:Envelope"]["s:Body"][0]["PRPA_IN201305UV02"][0]["controlActProcess"][0][
          "queryByParameter"
        ][0]["parameterList"][0];

      const patientName = parameterList["livingSubjectName"][0]["value"][0];
      const gender = parameterList["livingSubjectAdministrativeGender"][0]["value"][0]["$"]["code"];
      const dob = parameterList["livingSubjectBirthTime"][0]["value"][0]["$"]["value"];
      const address = parameterList["patientAddress"][0]["value"][0];
      const livingSubjectId = parameterList["livingSubjectId"][0]["value"][0]["$"]["extension"];

      const patientAddress: Address = {
        addressLine1: address["streetAddressLine"][0],
        city: address["city"][0],
        state: address["state"][0],
        zip: address["postalCode"][0],
        country: address["country"][0],
      };

      patientData = {
        externalId: livingSubjectId,
        firstName: patientName["given"][0],
        lastName: patientName["family"][0],
        dob: dob,
        genderAtBirth: gender,
        address: [patientAddress],
      };
    } catch {
      console.log("Unable to parse XML");
      console.log(result);
    }
  });
  console.log("patientData", patientData);

  return patientData || null;
}

export function parseXmlStringForRootExtension(xml: string): Promise<[string, string]> {
  xml = JSON.parse(`"${xml}"`);

  const parser = new xml2js.Parser();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return parser.parseStringPromise(xml).then(function (result: any) {
    const id = result["s:Envelope"]["s:Body"][0]["PRPA_IN201305UV02"][0]["id"][0];
    console.log("id", id);

    const root = id["$"]["root"];
    const extension = id["$"]["extension"];
    return [root, extension];
  });
}

export function generateTimeStrings(): {
  createdAt: string;
  expiresAt: string;
  creationTime: string;
} {
  const now = new Date();

  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours from now

  const createdAt = now.toISOString();
  const expiresAtStr = expiresAt.toISOString();

  // Get timezone offset in minutes
  const timezoneOffset = now.getTimezoneOffset();
  const timezoneOffsetHours = Math.floor(Math.abs(timezoneOffset) / 60);
  const timezoneOffsetMinutes = Math.abs(timezoneOffset) % 60;

  // Format timezone offset as "+HHMM" or "-HHMM"
  const timezoneOffsetStr =
    (timezoneOffset > 0 ? "-" : "+") +
    String(timezoneOffsetHours).padStart(2, "0") +
    String(timezoneOffsetMinutes).padStart(2, "0");

  // Format the creationTime in the required format
  const creationTime = now.toISOString().replace(/-|:|\.\d{3}/g, "") + timezoneOffsetStr;

  return { createdAt, expiresAt: expiresAtStr, creationTime };
}

// TODO NORMALIZE PATIENT DATA
// dob
// country
