import { XMLParser } from "fast-xml-parser";
import dayjs from "dayjs";
import { PatientResource, InboundPatientDiscoveryReq } from "@metriport/ihe-gateway-sdk";
import { toArray } from "@metriport/shared";
import { Iti55Request, iti55RequestSchema } from "./schema";
import { convertSamlHeaderToAttributes, extractTimestamp } from "../../shared";
import { extractText } from "../../../utils";
import { mapIheGenderToFhir } from "../../../../shared";

export function transformIti55RequestToPatientResource(
  iti55Request: Iti55Request
): PatientResource {
  const queryParams =
    iti55Request.Envelope.Body.PRPA_IN201305UV02.controlActProcess.queryByParameter.parameterList;

  const name = toArray(queryParams.livingSubjectName.value).map(name => ({
    family: extractText(name.family),
    given: toArray(name.given).map(extractText),
  }));

  const address = toArray(queryParams.patientAddress?.value).map(addr => ({
    line: toArray(addr.streetAddressLine).map(line => line.toString()),
    city: addr.city ? String(addr.city) : undefined,
    state: addr.state ? String(addr.state) : undefined,
    postalCode: addr.postalCode ? String(addr.postalCode) : undefined,
    country: addr.country ? String(addr.country) : undefined,
  }));

  const telecom = toArray(queryParams.patientTelecom?.value).map(tel => ({
    system: "phone",
    value: tel._value,
  }));

  const identifier = toArray(queryParams.livingSubjectId?.value).map(id => ({
    system: id._root,
    value: id._extension,
  }));

  const gender = mapIheGenderToFhir(queryParams.livingSubjectAdministrativeGender?.value?._code);
  const birthDate = dayjs(queryParams.livingSubjectBirthTime.value._value).format("YYYY-MM-DD");
  const patientResource = {
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
