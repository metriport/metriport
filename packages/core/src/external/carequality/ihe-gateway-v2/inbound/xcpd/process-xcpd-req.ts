import { XMLParser } from "fast-xml-parser";
import dayjs from "dayjs";
import { PatientResource, InboundPatientDiscoveryReq } from "@metriport/ihe-gateway-sdk";
import { toArray } from "@metriport/shared";
import { extractText } from "../../utils";
import { Iti55Request, iti55RequestSchema } from "./schema";
import { convertSamlHeaderToAttributes, extractTimestamp } from "../shared";
import { mapIheGenderToFhir } from "../../../shared";

export function transformIti55RequestToPatientResource(
  iti55Request: Iti55Request
): PatientResource {
  const queryParams =
    iti55Request.Envelope.Body.PRPA_IN201305UV02.controlActProcess.queryByParameter.parameterList;

  const name = toArray(queryParams.livingSubjectName).map(name => ({
    family: extractText(name.value.family),
    given: toArray(name.value.given).map(extractText),
  }));

  const address = toArray(queryParams.patientAddress).map(addr => ({
    line: toArray(addr.value.streetAddressLine).map(line => line.toString()),
    city: addr.value.city ? String(addr.value.city) : undefined,
    state: addr.value.state ? String(addr.value.state) : undefined,
    postalCode: addr.value.postalCode ? String(addr.value.postalCode) : undefined,
    country: addr.value.country ? String(addr.value.country) : undefined,
  }));

  // is it a phone or an email
  const telecom = toArray(queryParams.patientTelecom).map(tel => ({
    system: "phone",
    value: tel.value._value,
  }));

  const identifier = toArray(queryParams.livingSubjectId).map(id => ({
    system: id.value._root,
    value: id.value._extension,
  }));

  const gender = mapIheGenderToFhir(queryParams.livingSubjectAdministrativeGender?.value?._code);
  const birthDate = dayjs(queryParams.livingSubjectBirthTime.value._value).format("YYYY-MM-DD");
  const patientResource = {
    resourceType: "Patient",
    name,
    gender,
    birthDate,
    ...(address.length > 0 && { address }),
    ...(telecom.length > 0 && { telecom }),
    ...(identifier.length > 0 && { identifier }),
  };

  return patientResource;
}
export function processInboundXcpdRequest(request: string): InboundPatientDiscoveryReq {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "_",
    textNodeName: "_text",
    parseAttributeValue: false,
    removeNSPrefix: true,
  });
  const jsonObj = parser.parse(request);
  try {
    const iti55Request = iti55RequestSchema.parse(jsonObj);
    const samlAttributes = convertSamlHeaderToAttributes(iti55Request.Envelope.Header);
    const patientResource = transformIti55RequestToPatientResource(iti55Request);

    return {
      id: extractText(iti55Request.Envelope.Header.MessageID),
      timestamp: extractTimestamp(iti55Request.Envelope.Header),
      samlAttributes,
      patientResource,
      signatureConfirmation: extractText(
        iti55Request.Envelope.Header.Security.Signature.SignatureValue
      ),
    };
  } catch (error) {
    throw new Error(`Failed to parse ITI-55 request: ${error}`);
  }
}
