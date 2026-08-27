import {
  InboundDocumentQueryResp,
  InboundDocumentRetrievalResp,
  SamlAttributes,
} from "@metriport/ihe-gateway-sdk";
import { errorToString, MetriportError, toArray } from "@metriport/shared";
import { buildDayjs } from "@metriport/shared/common/date";
import { createXMLParser } from "@metriport/shared/common/xml-parser";
import * as crypto from "crypto";
import { out } from "../../../../util/log";
import { stripUrnPrefix } from "../../../../util/urn";
import { expiresIn, namespaces } from "../constants";
import { validateKeyIdentifier } from "../saml/security/validate";
import { verifySaml } from "../saml/security/verify";
import {
  AttributeValue,
  Code,
  ItiRequestWithSamlHeader,
  SamlHeader,
  SamlHeaderBase,
  soapWithHeaderBaseSchema,
  TextOrTextObject,
  treatmentPurposeOfUse,
} from "../schema";
import { defaultSubjectRole } from "../shared";
import { extractText } from "../utils";

export const successStatus = "urn:oasis:names:tc:ebxml-regrep:ResponseStatusType:Success";
export const failureStatus = "urn:oasis:names:tc:ebxml-regrep:ResponseStatusType:Failure";
export const errorSeverity = "urn:oasis:names:tc:ebxml-regrep:ErrorSeverityType:Error";

function istextSchema(value: AttributeValue): value is TextOrTextObject {
  return value != null && typeof value === "object" && "_text" in value;
}

function isRoleObject(value: AttributeValue): value is { Role: Code } {
  return value != null && typeof value === "object" && "Role" in value;
}

function isPurposeOfUseObject(value: AttributeValue): value is { PurposeOfUse: Code } {
  return value != null && typeof value === "object" && "PurposeOfUse" in value;
}

function getSourceAddress(header: SamlHeader): string | undefined {
  const address = header?.From?.Address;
  return address ? extractText(address) : undefined;
}

function getReplyTo(header: SamlHeader): string | undefined {
  const replyTo = header?.ReplyTo;
  return replyTo ? extractText(replyTo.Address) : undefined;
}

function getUserId(header: SamlHeader): string | undefined {
  const userId = header?.Security?.Assertion?.Subject?.NameID;
  return userId ? extractText(userId) : undefined;
}

export function convertSamlHeaderToAttributes(header: SamlHeader): SamlAttributes {
  const wsaFrom = getSourceAddress(header); // WS-Addressing
  const replyTo = getReplyTo(header);
  const userId = getUserId(header);

  const attributeStatement = toArray(header.Security.Assertion.AttributeStatement)?.[0];
  const attributes = toArray(attributeStatement?.Attribute);
  if (attributes.length === 0) {
    throw new MetriportError("Attributes are undefined");
  }

  function getAttributeValue(name: string): string | undefined {
    const attribute = attributes?.find(attr => attr._Name === name);
    if (!attribute) return undefined;
    if (typeof attribute.AttributeValue === "string") return attribute.AttributeValue;
    if (istextSchema(attribute.AttributeValue)) return extractText(attribute.AttributeValue);
    return undefined;
  }

  function getRoleAttributeValue(name: string):
    | {
        code: string;
        display: string;
        system: string;
      }
    | undefined {
    const attribute = attributes?.find(attr => attr._Name === name);
    if (!attribute) return undefined;
    if (isRoleObject(attribute.AttributeValue)) {
      return {
        code: attribute.AttributeValue.Role._code,
        display: attribute.AttributeValue.Role._displayName,
        system: attribute.AttributeValue.Role._codeSystem ?? defaultSubjectRole.system,
      };
    }
    return undefined;
  }

  function getPurposeOfUseAttributeValue(name: string): string | undefined {
    const attribute = attributes?.find(attr => attr._Name === name);
    if (!attribute) return undefined;
    if (isPurposeOfUseObject(attribute.AttributeValue)) {
      return attribute.AttributeValue.PurposeOfUse._code;
    }
    return undefined;
  }

  const subjectId = getAttributeValue("urn:oasis:names:tc:xspa:1.0:subject:subject-id");
  const defaultSubjectId = "unknown";

  const organization = getAttributeValue("urn:oasis:names:tc:xspa:1.0:subject:organization");
  if (!organization) {
    throw new MetriportError("Organization is required");
  }

  const organizationId = getAttributeValue("urn:oasis:names:tc:xspa:1.0:subject:organization-id");
  if (!organizationId) {
    throw new MetriportError("Organization ID is required");
  }

  const homeCommunityId = getAttributeValue("urn:nhin:names:saml:homeCommunityId");
  if (!homeCommunityId) {
    throw new MetriportError("Home community ID is required");
  }

  const subjectRole = getRoleAttributeValue("urn:oasis:names:tc:xacml:2.0:subject:role");

  const purposeOfUse = getPurposeOfUseAttributeValue(
    "urn:oasis:names:tc:xspa:1.0:subject:purposeofuse"
  );

  return {
    wsaFrom,
    replyTo,
    userId,
    subjectId: subjectId ?? defaultSubjectId,
    organization: organization,
    organizationId: stripUrnPrefix(organizationId),
    homeCommunityId: stripUrnPrefix(homeCommunityId),
    subjectRole: subjectRole ?? defaultSubjectRole,
    purposeOfUse: purposeOfUse ?? treatmentPurposeOfUse,
  };
}

export function extractTimestamp(header: SamlHeader): string {
  return header.Security.Timestamp.Created;
}

export function createSecurityHeader({
  signatureConfirmation,
}: {
  signatureConfirmation?: string | undefined;
}): object {
  const createdTimestamp = buildDayjs().toISOString();
  const expiresTimestamp = buildDayjs(createdTimestamp).add(expiresIn, "minute").toISOString();
  const securityHeader = {
    "wsse:Security": {
      "@_xmlns:wsse": namespaces.wsse,
      "@_xmlns:ds": namespaces.ds,
      "@_xmlns:wsu": namespaces.wsu,
      "wsu:Timestamp": {
        "wsu:Created": createdTimestamp,
        "wsu:Expires": expiresTimestamp,
      },
      SignatureConfirmation: {
        "@_xmlns": namespaces.wss,
        "@_Value": signatureConfirmation,
      },
    },
  };
  return securityHeader;
}

export function parseHeaderFromRequest(request: string): SamlHeaderBase {
  const parser = createXMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "_",
    textNodeName: "_text",
    parseAttributeValue: false,
    removeNSPrefix: true,
  });
  const jsonObj = parser.parse(request);
  try {
    const headerBase = soapWithHeaderBaseSchema.parse(jsonObj);
    return headerBase.Envelope.Header;
  } catch (error) {
    const log = out("parseHeaderFromRequest").log;
    const msg = "Failed to parse header from request";
    log(`${msg}: ${errorToString(error)}`);
    throw new MetriportError(msg, error, { context: "parseHeaderFromRequest" });
  }
}

function extractCertificateFromSaml<T extends ItiRequestWithSamlHeader>(
  itiRequest: T
): crypto.KeyLike {
  const certBase64 =
    itiRequest.Envelope.Header.Security.Assertion.Signature.KeyInfo.X509Data.X509Certificate;

  const certPem = `-----BEGIN CERTIFICATE-----\n${certBase64}\n-----END CERTIFICATE-----`;
  try {
    return crypto.createPublicKey({
      key: certPem,
      format: "pem",
    });
  } catch (error) {
    throw new MetriportError("Failed to parse X509Certificate from SAML message", error);
  }
}

export function parseAndValidateSamlSignature<T extends ItiRequestWithSamlHeader>(
  xmlString: string,
  itiRequest: T,
  log?: typeof console.log
): void {
  const publicCert = extractCertificateFromSaml(itiRequest);

  validateKeyIdentifier(itiRequest);

  const isSignatureValid = verifySaml({
    xmlString,
    publicCert,
  });

  if (!isSignatureValid) {
    const msg = "SAML signature verification failed";
    log && log(`${msg} for request ${extractText(itiRequest.Envelope.Header.MessageID)}`);
    const error = new MetriportError(msg, undefined, {
      requestId: extractText(itiRequest.Envelope.Header.MessageID),
    });
    throw error;
  }
}

export function buildRegistryErrorList(
  response: InboundDocumentQueryResp | InboundDocumentRetrievalResp,
  isSuccess: boolean
): object | undefined {
  if (isSuccess) return undefined;

  const registryErrors = (response?.operationOutcome?.issue || []).map(issue => ({
    "@_codeContext": issue.details.text,
    "@_errorCode": issue.details?.coding?.[0]?.code,
    "@_severity": errorSeverity,
  }));

  return {
    ...(registryErrors &&
      registryErrors.length > 0 && {
        RegistryErrorList: {
          RegistryError: registryErrors,
        },
      }),
  };
}
