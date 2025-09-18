import { InboundPatientDiscoveryReq, PatientResource } from "@metriport/ihe-gateway-sdk";
import { BadRequestError, errorToString, isEmail, isPhoneNumber, toArray } from "@metriport/shared";
import { createXMLParser } from "@metriport/shared/common/xml-parser";
import dayjs from "dayjs";
import { capture } from "../../../../../../util";
import { out } from "../../../../../../util/log";
import { mapIheGenderToFhir } from "../../../../shared";
import { storeXcpdRequest } from "../../../monitor/store";
import { extractText } from "../../../utils";
import { getPrincipalAndDelegatesMap } from "../../principal-and-delegates";
import { convertSamlHeaderToAttributes, extractTimestamp } from "../../shared";
import { Iti55Request, iti55RequestSchema } from "./schema";

export function transformIti55RequestToPatientResource(
  iti55Request: Iti55Request
): PatientResource {
  const queryParams =
    iti55Request.Envelope.Body.PRPA_IN201305UV02.controlActProcess.queryByParameter.parameterList;

  const name = toArray(queryParams.livingSubjectName).map(name => ({
    family: extractText(name.value.family),
    given: toArray(name.value.given).map(extractText),
  }));

  const address = toArray(queryParams.patientAddress?.value).map(addr => ({
    line: toArray(addr.streetAddressLine).map(line => line.toString()),
    city: addr.city ? String(addr.city) : undefined,
    state: addr.state ? String(addr.state) : undefined,
    postalCode: addr.postalCode ? String(addr.postalCode) : undefined,
    country: addr.country ? String(addr.country) : undefined,
  }));

  const telecom = toArray(queryParams.patientTelecom?.value).flatMap(tel => {
    const value = tel._value;
    if (isPhoneNumber(value)) {
      return [{ system: "phone", value }];
    } else if (isEmail(value)) {
      return [{ system: "email", value }];
    }
    return [];
  });

  const identifier = toArray(queryParams.livingSubjectId)
    .flatMap(subjectId => toArray(subjectId.value ?? []))
    .map(id => ({
      system: id._root,
      value: id._extension,
    }));

  const iheGender = queryParams.livingSubjectAdministrativeGender?.value
    ? queryParams.livingSubjectAdministrativeGender?.value._code
    : undefined;
  const gender = mapIheGenderToFhir(iheGender);
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
export async function processInboundXcpdRequest(
  request: string
): Promise<InboundPatientDiscoveryReq> {
  const log = out("Inbound XCPD Request").log;
  const parser = createXMLParser({
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

    const inboundRequest = {
      id: extractText(iti55Request.Envelope.Header.MessageID),
      timestamp: extractTimestamp(iti55Request.Envelope.Header),
      samlAttributes,
      patientResource,
      signatureConfirmation: extractText(
        iti55Request.Envelope.Header.Security.Signature.SignatureValue
      ),
    };

    await storeXcpdRequest({ request, inboundRequest });
    if (samlAttributes.principalOid) {
      console.log(
        "validating delegated request",
        samlAttributes.organization,
        samlAttributes.principalOid
      );
      await validateDelegatedRequest(samlAttributes.organization, samlAttributes.principalOid);
      console.log("delegated request validated");
    }

    return inboundRequest;
  } catch (error) {
    const msg = "Failed to parse ITI-55 request";
    log(
      `${msg}: Error - ${errorToString(error)}, iti55Request: ${JSON.stringify(
        jsonObj
      )}, request: ${request}`
    );
    capture.error(msg, {
      extra: {
        error,
        request,
      },
    });
    throw new Error(`${msg}: ${error}`);
  }
}

async function validateDelegatedRequest(principal: string, delegate: string) {
  const principalAndDelegatesMap = await getPrincipalAndDelegatesMap();
  const delegates = principalAndDelegatesMap.get(principal);
  console.log("delegates", delegates);
  if (!delegates) {
    throw new BadRequestError(
      "Principal organization not found or has no listed delegates",
      undefined,
      {
        principalOid: principal,
        delegateOid: delegate,
      }
    );
  }
  if (!delegates.includes(delegate)) {
    throw new BadRequestError(
      "Delegate organization is not authorized by the principal",
      undefined,
      {
        principalOid: principal,
        delegateOid: delegate,
      }
    );
  }
}
