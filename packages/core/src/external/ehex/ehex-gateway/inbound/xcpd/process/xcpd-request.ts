import {
  InboundPatientDiscoveryReq,
  InboundPatientDiscoveryResp,
  PatientResource,
} from "@metriport/ihe-gateway-sdk";
import { BadRequestError, errorToString, isEmail, isPhoneNumber, toArray } from "@metriport/shared";
import { buildDayjs } from "@metriport/shared/common/date";
import { createXMLParser } from "@metriport/shared/common/xml-parser";
import { DOMParser, XMLSerializer } from "@xmldom/xmldom";
import * as xpath from "xpath";
import {
  NetworkAccessPointTypeCode,
  UNDEFINED_HTTP_STATUS_CODE,
} from "../../../../../../audit-log/types";
import { InboundMpiMetriportApi } from "../../../../../../mpi/inbound-patient-mpi-metriport-api";
import { Config } from "../../../../../../util/config";
import { out } from "../../../../../../util/log";
import { getClientAddressFromHeader } from "../../../../../aws/api-gw";
import { processInboundXcpd } from "../../../../pd/process-inbound-pd";
import { mapIheGenderToFhir } from "../../../../shared";
import {
  safeStoreInboundXcpdRequest,
  safeStoreInboundXcpdReqRespJson,
} from "../../../monitor/store";
import { REDACTED } from "../../../shared";
import { extractText, getQueryByParameterFromIti55RequestXml } from "../../../utils";
import { auditPdSafe } from "../../ehex-gateway-inbound-auditing";
import {
  convertSamlHeaderToAttributes,
  extractTimestamp,
  parseAndValidateSamlSignature,
} from "../../shared";
import { createInboundXcpdResponse } from "../create/xcpd-response";
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
    line: toArray(addr.streetAddressLine).map(line => extractText(line)),
    city: addr.city ? extractText(addr.city) : undefined,
    state: addr.state ? extractText(addr.state) : undefined,
    postalCode: addr.postalCode ? extractText(addr.postalCode) : undefined,
    country: addr.country ? extractText(addr.country) : undefined,
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
  const birthDate = buildDayjs(queryParams.livingSubjectBirthTime.value._value).format(
    "YYYY-MM-DD"
  );
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

function parseAndValidateInboundXcpdRequest(request: string): {
  request: InboundPatientDiscoveryReq;
  rawQueryInXml: string;
} {
  const log = out("parseAndValidateInboundXcpdRequest").log;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let jsonObj: any;
  try {
    const parser = createXMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "_",
      textNodeName: "_text",
      parseAttributeValue: false,
      removeNSPrefix: true,
    });

    jsonObj = parser.parse(request);

    const iti55Request = iti55RequestSchema.parse(jsonObj);
    parseAndValidateSamlSignature(request, iti55Request, log);
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

    const queryByParameterXml = getQueryByParameterFromIti55RequestXml(request);
    return { request: inboundRequest, rawQueryInXml: queryByParameterXml };
  } catch (error) {
    const msg = "Failed to parse ITI-55 request";
    throw new BadRequestError(msg, error, {
      ...(jsonObj?.Envelope?.Header?.MessageID
        ? { requestId: extractText(jsonObj.Envelope.Header.MessageID) }
        : {}),
      error: errorToString(error),
    });
  }
}

export async function processInboundXcpdRequest({
  appInstanceId,
  body,
  apiUrl,
  headers,
}: {
  appInstanceId: string;
  body: string;
  apiUrl: string;
  headers?: Record<string, string | undefined>;
}): Promise<{ statusCode: number; payload: string }> {
  const { log } = out(`ehex-processInboundXcpdRequest`);
  const mpi = new InboundMpiMetriportApi(apiUrl);
  let result: InboundPatientDiscoveryResp | undefined;
  let statusCode = UNDEFINED_HTTP_STATUS_CODE;
  let outcomeDesc: string | undefined;
  const startTime = buildDayjs().toDate();
  const isDebugModeActive = Config.isDebugModeEnabled();

  const { request: pdRequest, rawQueryInXml: queryByParameterInXml } =
    parseAndValidateInboundXcpdRequest(body);

  await safeStoreInboundXcpdRequest({
    request: body,
    inboundRequest: pdRequest,
  });
  if (isDebugModeActive) {
    log(
      "pdRequest: ",
      JSON.stringify({
        ...pdRequest,
        patientResource: REDACTED,
      })
    );
  }

  const clientAddress = getClientAddressFromHeader(headers);
  const initiatorAddress = clientAddress
    ? {
        type: NetworkAccessPointTypeCode.IpAddress,
        address: clientAddress,
      }
    : undefined;
  try {
    result = await processInboundXcpd(pdRequest, mpi);
    if (isDebugModeActive) {
      log(
        "result: ",
        JSON.stringify({
          ...result,
          patientResource: REDACTED,
        })
      );
      await safeStoreInboundXcpdReqRespJson({
        inboundRequest: pdRequest,
        inboundResponse: result,
      });
    }

    let xmlResponse = createInboundXcpdResponse({
      request: pdRequest,
      response: result,
      queryByParameter: "PLACEHOLDER",
    });
    // The reason we set `queryByParameter` to "PLACEHOLDER" above and replace it completely below
    // is because we need to return the exact same XML element as `queryByParameter` in the
    // request XML.
    xmlResponse = insertQueryByParameterIntoResponse(xmlResponse, queryByParameterInXml);

    statusCode = 200;
    return { statusCode, payload: xmlResponse };
  } catch (error) {
    outcomeDesc = errorToString(error, { detailed: true });
    if (error instanceof BadRequestError) {
      statusCode = 400;
      log(`Client error: ${outcomeDesc}`);
    } else {
      statusCode = 500;
      log(`Server error: ${outcomeDesc}`);
    }
    throw error;
  } finally {
    await auditPdSafe({
      appInstanceId,
      initiatorAddress,
      query: queryByParameterInXml,
      request: pdRequest,
      response: result,
      startTime,
      statusCode,
      outcomeDesc,
    });
  }
}

// TODO ENG-1601 Consider moving this to a dedicated XML file
function insertQueryByParameterIntoResponse(
  xmlResponse: string,
  queryByParameterXml: string
): string {
  const doc = new DOMParser().parseFromString(xmlResponse, "text/xml");
  const queryByParameterNodes = xpath.select(
    "//*[local-name(.)='queryByParameter']",
    doc
  ) as Node[];
  if (queryByParameterNodes.length === 0) {
    throw new Error("queryByParameter element not found in response");
  }
  const firstNode = queryByParameterNodes[0];
  if (!firstNode) {
    throw new Error("queryByParameter element not found in request");
  }
  const parentNode = firstNode.parentNode;
  if (!parentNode) {
    throw new Error("queryByParameter parent node not found");
  }
  const queryByParameterDoc = new DOMParser().parseFromString(queryByParameterXml, "text/xml");
  const importedNode = doc.importNode(queryByParameterDoc.documentElement, true);
  parentNode.replaceChild(importedNode, firstNode);
  const serializer = new XMLSerializer();
  return serializer.serializeToString(doc);
}
