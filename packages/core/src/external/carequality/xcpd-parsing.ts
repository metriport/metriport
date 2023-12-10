import * as xml2js from "xml2js";
import { PatientData, LivingSubjectId, PrincipalCareProviderId } from "./patient-incoming-schema";
import { Address } from "@metriport/api-sdk/medical/models/common/address";

// TODO whole file should be migrated into mirth replacement module once we pass verification with testing partners.

export function parseXmlStringForPatientData(xml: string): Promise<PatientData> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const parser = new xml2js.Parser({
    tagNameProcessors: [xml2js.processors.stripPrefix],
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return parser.parseStringPromise(xml).then(function (result: any) {
    const parameterList =
      result["Envelope"]["Body"][0]["PRPA_IN201305UV02"][0]["controlActProcess"][0][
        "queryByParameter"
      ][0]["parameterList"][0];
    const patientName = parameterList["livingSubjectName"][0]["value"][0];
    const gender = parameterList["livingSubjectAdministrativeGender"][0]["value"][0]["$"]["code"];
    const dob = parameterList["livingSubjectBirthTime"][0]["value"][0]["$"]["value"];
    const address = parameterList["patientAddress"][0]["value"][0];

    let phone = "";
    if (parameterList["patientTelecom"] && parameterList["patientTelecom"][0]["value"]) {
      phone = parameterList["patientTelecom"][0]["value"][0]["$"]["value"];
    }

    let livingSubjectId: LivingSubjectId | undefined;
    if (
      parameterList["livingSubjectId"] &&
      parameterList["livingSubjectId"][0]["value"] &&
      parameterList["livingSubjectId"][0]["value"][0]["$"]
    ) {
      livingSubjectId = {
        extension: parameterList["livingSubjectId"][0]["value"][0]["$"]["extension"],
        root: parameterList["livingSubjectId"][0]["value"][0]["$"]["root"],
      };
    }
    let principalCareProviderId: PrincipalCareProviderId | undefined;
    if (
      parameterList["principalCareProviderId"] &&
      parameterList["principalCareProviderId"][0]["value"] &&
      parameterList["principalCareProviderId"][0]["value"][0]["$"]
    ) {
      principalCareProviderId = {
        extension: parameterList["principalCareProviderId"][0]["value"][0]["$"]["extension"],
        root: parameterList["principalCareProviderId"][0]["value"][0]["$"]["root"],
      };
    }

    const patientAddress: Address = {
      addressLine1: address["streetAddressLine"][0],
      city: address["city"][0],
      state: address["state"][0],
      zip: address["postalCode"][0],
      country: address["country"] ? address["country"][0] : "USA",
    };

    const patientData = {
      livingSubjectId: livingSubjectId,
      principalCareProviderId: principalCareProviderId,
      firstName: patientName["given"][0],
      lastName: patientName["family"][0],
      dob: dob,
      genderAtBirth: gender,
      address: [patientAddress],
      contact: [{ phone: phone }],
    };
    return patientData;
  });
}

export function parseXmlStringForRootExtensionSignature(
  xml: string
): Promise<[string, string, string]> {
  const parser = new xml2js.Parser({
    tagNameProcessors: [xml2js.processors.stripPrefix],
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return parser.parseStringPromise(xml).then(function (result: any) {
    const signature =
      result["Envelope"]["Header"][0]["Security"][0]["Signature"][0]["SignatureValue"][0];
    /* The line `const id = result["s:Envelope"]["s:Body"][0]["PRPA_IN201305UV02"][0]["id"][0];` is
extracting the value of the `id` element from the XML response. It is accessing the nested
properties of the `result` object to navigate to the desired element and retrieve its value. */
    const id = result["Envelope"]["Body"][0]["PRPA_IN201305UV02"][0]["id"][0];
    const root = id["$"]["root"];
    const extension = id["$"]["extension"];
    return [root, extension, signature];
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

export const fillTemplate = (
  xcpdTemplate: string,
  createdAt: string,
  expiresAt: string,
  creationTime: string,
  root: string,
  extension: string,
  signature: string,
  patientData: PatientData
) => {
  const { firstName, lastName, dob, genderAtBirth, livingSubjectId, address, contact } =
    patientData;

  let phone = "";
  if (contact && Array.isArray(contact) && contact.length > 0 && contact[0]) {
    phone = contact[0].phone || "";
  }

  let addressLine1, city, state, zip, country;
  if (Array.isArray(address) && typeof address[0] === "object") {
    ({ addressLine1, city, state, zip, country } = address[0]);
  }

  return xcpdTemplate
    .replace(/{createdAt}/g, createdAt)
    .replace(/{expiresAt}/g, expiresAt)
    .replace(/{creationTime}/g, creationTime)
    .replace(/{root}/g, root)
    .replace(/{extension}/g, extension)
    .replace(/{signature}/g, signature)
    .replace(/{firstName}/g, firstName)
    .replace(/{lastName}/g, lastName)
    .replace(/{dob}/g, dob)
    .replace(/{genderAtBirth}/g, genderAtBirth)
    .replace(/{addressLine1}/g, addressLine1 || "")
    .replace(/{city}/g, city || "")
    .replace(/{state}/g, state || "")
    .replace(/{zip}/g, zip || "")
    .replace(/{country}/g, country || "")
    .replace(/{livingSubjectId.extension}/g, livingSubjectId?.extension || "ABCDEFG")
    .replace(/{livingSubjectId.root}/g, livingSubjectId?.root || "123456789")
    .replace(/{phone}/g, phone || "000-000-0000");
};

// data normalizing
