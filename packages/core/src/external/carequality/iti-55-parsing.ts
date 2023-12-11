import * as xml2js from "xml2js";
import { PatientData, LivingSubjectId, PrincipalCareProviderId } from "./patient-incoming-schema";
import { generateTimeStrings } from "./utils";
import { xcpdTemplate } from "./iti-55-template";
import { Address } from "@metriport/api-sdk/medical/models/common/address";
import { USState } from "@metriport/api-sdk/medical/models/common/us-data";
import jaroWinkler from "jaro-winkler";

// TODO whole file should be migrated into mirth replacement module once we pass verification with testing partners.
const SIMILARITY_THRESHOLD = 0.9;

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
    const id = result["Envelope"]["Body"][0]["PRPA_IN201305UV02"][0]["id"][0];
    const root = id["$"]["root"];
    const extension = id["$"]["extension"];
    return [root, extension, signature];
  });
}

const fillTemplate = (
  xcpdTemplate: string,
  createdAt: string,
  expiresAt: string,
  creationTime: string,
  root: string,
  extension: string,
  signature: string,
  patientData: PatientData
) => {
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
    .replace(/{phone}/g, phone || "000-000-0000")
    .replace(/{patientId}/g, id || "1234567890")
    .replace(/{systemId}/g, systemId || "1.2.840.114350.1.13.11511.3.7.3.688884.100.1000");
};

export function generateXCPD(xml: string, patientData: PatientData): Promise<string> {
  return parseXmlStringForRootExtensionSignature(xml).then(
    ([root, extension, signature]: [string, string, string]) => {
      const { createdAt, expiresAt, creationTime } = generateTimeStrings();
      const xcpd = fillTemplate(
        xcpdTemplate,
        createdAt,
        expiresAt,
        creationTime,
        root,
        extension,
        signature,
        patientData
      );
      return xcpd;
    }
  );
}
export function isAnyPatientMatching(patientToMatch: PatientData): PatientData | undefined {
  const patients = [patient_1, patient_2, patient_3];
  for (const patient of patients) {
    if (isPatientMatching(patient, patientToMatch)) {
      return patient;
    }
  }
  return undefined;
}

export const isPatientMatching = (patient1: PatientData, patient2: PatientData): boolean => {
  let score = 0;
  let fieldCount = 0;

  const addScore = (value1: string, value2: string) => {
    const similarity = jaroWinkler(value1, value2);
    score += similarity;
    fieldCount += 1;
  };

  addScore(patient1.firstName, patient2.firstName);
  addScore(patient1.lastName, patient2.lastName);
  addScore(patient1.dob, patient2.dob);
  addScore(patient1.genderAtBirth, patient2.genderAtBirth);

  const totalScore = score / fieldCount;
  return totalScore >= SIMILARITY_THRESHOLD;
};

const patient_1 = {
  id: "EV38NJT4M6Q2B5X",
  documentId: "1.2.840.114350.1.13.11511.3.7.8.456721.987654",
  firstName: "Skwisgaar",
  lastName: "Skwigelf",
  dob: "1969-04-20",
  genderAtBirth: "M" as "F" | "M",
  address: [
    {
      addressLine1: "2517 Durant Ave",
      city: "Berkeley",
      state: "CA" as USState,
      zip: "94704",
      // eslint-disable-next-line @typescript-eslint/prefer-as-const
      country: "USA" as "USA",
    },
  ],
  contact: [
    {
      phone: "666-666-6666",
    },
  ],
};

const patient_2 = {
  id: "EV72KHP9L1C3FA4",
  documentId: "1.2.840.114350.1.13.11511.3.7.8.234587.334455",
  firstName: "Federico",
  lastName: "Aufderhar",
  dob: "1981-07-12",
  genderAtBirth: "M" as "F" | "M",
  address: [
    {
      addressLine1: "237 Hegmann Avenue",
      city: "Berkley",
      state: "MA" as USState,
      zip: "02779 1234",
      // eslint-disable-next-line @typescript-eslint/prefer-as-const
      country: "USA" as "USA",
    },
  ],
  contact: [
    {
      phone: "1-234-567-8910",
    },
  ],
};

const patient_3 = {
  id: "EV72KHP9L1C3FA4",
  documentId: "1.2.840.114350.1.13.11511.3.7.8.123456.789012",
  firstName: "NWHINONE",
  lastName: "NWHINZZZTESTPATIENT",
  dob: "1981-01-01",
  genderAtBirth: "M" as "F" | "M",
  address: [
    {
      addressLine1: "1100 Test Street",
      city: "Helena",
      state: "AL" as USState,
      zip: "35080",
      // eslint-disable-next-line @typescript-eslint/prefer-as-const
      country: "USA" as "USA",
    },
  ],
  contact: [
    {
      phone: "205-111-1111",
    },
  ],
};
