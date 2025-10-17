import { SamlAttributes } from "@metriport/ihe-gateway-sdk";
import { BadRequestError, toArray } from "@metriport/shared";
import dayjs from "dayjs";
import { stripUrnPrefix } from "../../../../util/urn";
import { getCachedPrincipalAndDelegatesMap } from "../../../hie-shared/principal-and-delegates-cache";
import { expiresIn, namespaces } from "../constants";
import {
  AttributeValue,
  Code,
  SamlHeader,
  TextOrTextObject,
  treatmentPurposeOfUse,
} from "../schema";
import { extractText } from "../utils";

export const successStatus = "urn:oasis:names:tc:ebxml-regrep:ResponseStatusType:Success";
export const failureStatus = "urn:oasis:names:tc:ebxml-regrep:ResponseStatusType:Failure";
export const errorSeverity = "urn:oasis:names:tc:ebxml-regrep:ErrorSeverityType:Error";

function istextSchema(value: AttributeValue): value is TextOrTextObject {
  return typeof value === "object" && "_text" in value;
}

function isRoleObject(value: AttributeValue): value is { Role: Code } {
  return typeof value === "object" && "Role" in value;
}

function isPurposeOfUseObject(value: AttributeValue): value is { PurposeOfUse: Code } {
  return typeof value === "object" && "PurposeOfUse" in value;
}

export function convertSamlHeaderToAttributes(header: SamlHeader): SamlAttributes {
  const attributes = toArray(header.Security.Assertion.AttributeStatement)?.[0]?.Attribute;
  if (attributes === undefined) {
    throw new Error("Attributes are undefined");
  }

  function getAttributeValue(name: string): string | undefined {
    const attribute = attributes?.find(attr => attr._Name === name);
    if (!attribute) return undefined;
    if (typeof attribute.AttributeValue === "string") return attribute.AttributeValue;
    if (istextSchema(attribute.AttributeValue)) return extractText(attribute.AttributeValue);
    return undefined;
  }

  function getRoleAttributeValue(name: string): { code: string; display: string } | undefined {
    const attribute = attributes?.find(attr => attr._Name === name);
    if (!attribute) return undefined;
    if (isRoleObject(attribute.AttributeValue)) {
      return {
        code: attribute.AttributeValue.Role._code,
        display: attribute.AttributeValue.Role._displayName,
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

  function getPrincipalOidAttributevalue(name: string): string | undefined {
    const attribute = attributes?.find(attr => attr._Name === name);
    if (!attribute) return undefined;
    if (typeof attribute.AttributeValue === "string") {
      return removeOrganizationPrefix(attribute.AttributeValue);
    }
    if (istextSchema(attribute.AttributeValue)) {
      return removeOrganizationPrefix(extractText(attribute.AttributeValue));
    }
    return undefined;
  }

  const subjectId = getAttributeValue("urn:oasis:names:tc:xspa:1.0:subject:subject-id");
  const defaultSubjectId = "unknown";

  const organization = getAttributeValue("urn:oasis:names:tc:xspa:1.0:subject:organization");
  if (!organization) {
    throw new Error("Organization is required");
  }

  const organizationId = getAttributeValue("urn:oasis:names:tc:xspa:1.0:subject:organization-id");
  if (!organizationId) {
    throw new Error("Organization ID is required");
  }

  const homeCommunityId = getAttributeValue("urn:nhin:names:saml:homeCommunityId");
  if (!homeCommunityId) {
    throw new Error("Home community ID is required");
  }

  const subjectRole = getRoleAttributeValue("urn:oasis:names:tc:xacml:2.0:subject:role");
  const defaultSubjectRole = {
    code: "106331006",
    display: "Administrative AND/OR managerial worker",
  };

  const purposeOfUse = getPurposeOfUseAttributeValue(
    "urn:oasis:names:tc:xspa:1.0:subject:purposeofuse"
  );

  const principalOid = getPrincipalOidAttributevalue("QueryAuthGrantor");

  return {
    subjectId: subjectId ?? defaultSubjectId,
    organization: organization,
    organizationId: stripUrnPrefix(organizationId),
    homeCommunityId: stripUrnPrefix(homeCommunityId),
    subjectRole: subjectRole ?? defaultSubjectRole,
    purposeOfUse: purposeOfUse ?? treatmentPurposeOfUse,
    principalOid,
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
  const createdTimestamp = dayjs().toISOString();
  const expiresTimestamp = dayjs(createdTimestamp).add(expiresIn, "minute").toISOString();
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
        SignatureValue: signatureConfirmation,
      },
    },
  };
  return securityHeader;
}

function removeOrganizationPrefix(referenceValue: string): string {
  return referenceValue.replace("Organization/", "");
}

export async function validateDelegatedRequest(principal: string, delegate: string) {
  const principalAndDelegatesMap = await getCachedPrincipalAndDelegatesMap("cq");
  const delegates = principalAndDelegatesMap.get(principal);
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
    throw new BadRequestError("Delegate organization is not authorized by the grantor", undefined, {
      principalOid: principal,
      delegateOid: delegate,
    });
  }
}
