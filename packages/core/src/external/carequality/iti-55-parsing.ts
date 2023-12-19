import * as xml2js from "xml2js";
import {
  PatientDataMPI,
  Address,
  LivingSubjectId,
  PrincipalCareProviderId,
} from "../mpi/patient-incoming-schema";
import { cleanXml, generateTimeStrings } from "./utils";
import { generateXcpdTemplate } from "./iti-55-template";
import { isAnyPatientMatching } from "./patient-matching";

/**
 * Parses an XML string and extracts patient data and other information.
 * @param xml - The XML string to be parsed.
 * @returns A promise that resolves to an array containing the parsed patient data object and the root ID, extension ID, and signature extracted from the XML.
 */
async function parseXmlString(
  xml: string
): Promise<[PatientDataMPI, [string, string, string | undefined, string]]> {
  // Removing leading newlines and escaping double quote variations
  xml = cleanXml(xml);
  const parser = new xml2js.Parser({
    tagNameProcessors: [xml2js.processors.stripPrefix],
  });

  let result;
  try {
    result = await parser.parseStringPromise(xml);
  } catch (error) {
    console.error(error);
    throw new Error("XML parsing failed: Invalid XML");
  }

  const address =
    result?.["Envelope"]?.["Body"]?.[0]?.["PRPA_IN201305UV02"]?.[0]?.["controlActProcess"]?.[0]?.[
      "queryByParameter"
    ]?.[0]?.["parameterList"]?.[0]?.["patientAddress"]?.[0]?.["value"]?.[0];

  // these need to be defined
  let parameterList, patientName, gender, dob, signature, messageId;
  let patientAddress: Address[] = [];
  try {
    parameterList =
      result["Envelope"]["Body"][0]["PRPA_IN201305UV02"][0]["controlActProcess"][0][
        "queryByParameter"
      ][0]["parameterList"][0];
    patientName = parameterList["livingSubjectName"][0]["value"][0];
    gender = parameterList["livingSubjectAdministrativeGender"][0]["value"][0]["$"]["code"];
    dob = parameterList["livingSubjectBirthTime"][0]["value"][0]["$"]["value"];
    signature = result["Envelope"]["Header"][0]["Security"][0]["Signature"][0]["SignatureValue"][0];
    messageId = result["Envelope"]["Header"][0]["MessageID"][0];
    if (address) {
      if (address) {
        patientAddress = [
          {
            addressLine1: address["streetAddressLine"][0],
            city: address["city"][0],
            state: address["state"][0],
            zip: address["postalCode"][0],
            country: address["country"][0] || "USA",
            addressLine2: "",
          },
        ];
      }
    }
  } catch (error) {
    throw new Error(
      "XML parsing failed: A Required field is missing. Either patientName, gender, dob, signature, messageId, or patientAddress is missing."
    );
  }

  // these dont need to be defined
  const phone =
    result?.["Envelope"]?.["Body"]?.[0]?.["PRPA_IN201305UV02"]?.[0]?.["controlActProcess"]?.[0]?.[
      "queryByParameter"
    ]?.[0]?.["parameterList"]?.[0]?.["patientTelecom"]?.[0]?.["value"]?.[0]?.["$"]?.["value"];
  const queryId =
    result?.["Envelope"]?.["Body"]?.[0]?.["PRPA_IN201305UV02"]?.[0]?.["controlActProcess"]?.[0]?.[
      "queryByParameter"
    ]?.[0]?.["queryId"]?.[0]?.["$"]?.["extension"];
  const root =
    result?.["Envelope"]?.["Body"]?.[0]?.["PRPA_IN201305UV02"]?.[0]?.["id"]?.[0]?.["$"]?.["root"];

  const livingSubjectId: LivingSubjectId | undefined = parameterList["livingSubjectId"]?.[0]?.[
    "value"
  ]?.[0]?.["$"]
    ? {
        extension: parameterList["livingSubjectId"][0]["value"][0]["$"]?.["extension"],
        root: parameterList["livingSubjectId"][0]["value"][0]["$"]?.["root"],
      }
    : undefined;

  const principalCareProviderId: PrincipalCareProviderId | undefined = parameterList[
    "principalCareProviderId"
  ]?.[0]?.["value"]?.[0]?.["$"]
    ? {
        extension: parameterList["principalCareProviderId"][0]["value"][0]["$"]?.["extension"],
        root: parameterList["principalCareProviderId"][0]["value"][0]["$"]?.["root"],
      }
    : undefined;

  const patientData: PatientDataMPI = {
    id: "",
    firstName: patientName["given"][0],
    lastName: patientName["family"][0],
    dob: dob,
    genderAtBirth: gender,
    address: patientAddress,
    contact: [{ phone: phone }],
  };
  if (livingSubjectId) {
    patientData.livingSubjectId = livingSubjectId;
  }

  if (principalCareProviderId) {
    patientData.principalCareProviderId = principalCareProviderId;
  }
  return [patientData, [root, messageId, queryId, signature]];
}

const fillTemplate = (
  xcpdTemplate: string,
  createdAt: string,
  expiresAt: string,
  creationTime: string,
  root: string,
  messageId: string,
  queryId: string | undefined,
  signature: string,
  status: string,
  patientData?: PatientDataMPI
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

    let addressLine1,
      city,
      state,
      zip,
      country = "";
    if (Array.isArray(address) && typeof address[0] === "object") {
      ({ addressLine1, city, state, zip, country = "USA" } = address[0]);
    }

    return xcpdTemplate
      .replace(/{createdAt}/g, createdAt)
      .replace(/{expiresAt}/g, expiresAt)
      .replace(/{creationTime}/g, creationTime)
      .replace(/{root}/g, root)
      .replace(/{messageId}/g, messageId)
      .replace(/{queryId}/g, queryId || "")
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
    .replace(/{queryId}/g, queryId || "")
    .replace(/{signature}/g, signature)
    .replace(/{code}/g, status);
};

export async function generateXCPD(xml: string): Promise<string> {
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
}
// comment for diff.
