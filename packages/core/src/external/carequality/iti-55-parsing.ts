import * as xml2js from "xml2js";
import { PatientData, LivingSubjectId, PrincipalCareProviderId } from "./patient-incoming-schema";
import { cleanXml, generateTimeStrings } from "./utils";
import { generateXcpdTemplate } from "./iti-55-template";
import { Address } from "@metriport/api-sdk/medical/models/common/address";
import { isAnyPatientMatching } from "./patient-matching";

/**
 * Parses an XML string and extracts patient data and other information.
 * @param xml - The XML string to be parsed.
 * @returns A promise that resolves to an array containing the parsed patient data object and the root ID, extension ID, and signature extracted from the XML.
 */
async function parseXmlString(
  xml: string
): Promise<[PatientData, [string, string, string, string]]> {
  // Removing leading newlines and escaping double quote variations
  xml = cleanXml(xml);

  const parser = new xml2js.Parser({
    tagNameProcessors: [xml2js.processors.stripPrefix],
  });

  try {
    //eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await parser.parseStringPromise(xml);
    const queryId =
      result["Envelope"]["Body"][0]["PRPA_IN201305UV02"][0]["controlActProcess"][0][
        "queryByParameter"
      ][0]["queryId"][0]["$"]["extension"];
    const parameterList =
      result["Envelope"]["Body"][0]["PRPA_IN201305UV02"][0]["controlActProcess"][0][
        "queryByParameter"
      ][0]["parameterList"][0];
    const patientName = parameterList["livingSubjectName"][0]["value"][0];
    const gender = parameterList["livingSubjectAdministrativeGender"][0]["value"][0]["$"]["code"];
    const dob = parameterList["livingSubjectBirthTime"][0]["value"][0]["$"]["value"];
    const address = parameterList["patientAddress"][0]["value"][0];
    const signature =
      result["Envelope"]["Header"][0]["Security"][0]["Signature"][0]["SignatureValue"][0];
    const bodyId = result["Envelope"]["Body"][0]["PRPA_IN201305UV02"][0]["id"][0];
    const root = bodyId["$"]["root"];

    const messageId = result["Envelope"]["Header"][0]["MessageID"][0];

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
    return [patientData, [root, messageId, queryId, signature]];
  } catch (error) {
    console.error(error);
    throw new Error("XML parsing failed");
  }
}

const fillTemplate = (
  xcpdTemplate: string,
  createdAt: string,
  expiresAt: string,
  creationTime: string,
  root: string,
  messageId: string,
  queryId: string,
  signature: string,
  status: string,
  patientData?: PatientData
) => {
  if (patientData) {
    const {
      firstName,
      lastName,
      dob,
      genderAtBirth,
      livingSubjectId,
      address,
      contact,
      id,
      systemId,
    } = patientData;

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
      .replace(/{messageId}/g, messageId)
      .replace(/{queryId}/g, queryId)
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
      .replace(/{phone}/g, phone || "000-000-0000")
      .replace(/{patientId}/g, id || "1234567890")
      .replace(/{systemId}/g, systemId || "1.2.840.114350.1.13.11511.3.7.3.688884.100.1000")
      .replace(/{code}/g, status);
  }
  return xcpdTemplate
    .replace(/{createdAt}/g, createdAt)
    .replace(/{expiresAt}/g, expiresAt)
    .replace(/{creationTime}/g, creationTime)
    .replace(/{root}/g, root)
    .replace(/{messageId}/g, messageId)
    .replace(/{queryId}/g, queryId)
    .replace(/{signature}/g, signature)
    .replace(/{code}/g, status);
};

export async function generateXCPD(xml: string): Promise<string> {
  try {
    const [patientData, [root, messageId, queryId, signature]] = await parseXmlString(xml);
    const matchingPatient = isAnyPatientMatching(patientData);
    let status = "";
    if (matchingPatient) {
      status = "OK";
    } else {
      console.log("no patient matching");
      status = "NF";
    }
    const { createdAt, expiresAt, creationTime } = generateTimeStrings();
    const xcpdTemplate = generateXcpdTemplate(status);
    const xcpd = fillTemplate(
      xcpdTemplate,
      createdAt,
      expiresAt,
      creationTime,
      root,
      messageId,
      queryId,
      signature,
      status,
      matchingPatient
    );
    return xcpd;
  } catch (error) {
    console.error(error);
    throw new Error("XML parsing failed");
  }
}
