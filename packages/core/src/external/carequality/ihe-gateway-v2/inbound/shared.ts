import { SamlAttributes } from "@metriport/ihe-gateway-sdk";
import {
  SamlHeader,
  Code,
  treatmentPurposeOfUse,
  TextOrTextObject,
  AttributeValue,
} from "../schema";
import { extractText } from "../utils";

const isTextSchema = (value: AttributeValue): value is TextOrTextObject => {
  return typeof value === "object" && "_text" in value;
};

const isRoleObject = (value: AttributeValue): value is { Role: Code } => {
  return typeof value === "object" && "Role" in value;
};

const isPurposeOfUseObject = (value: AttributeValue): value is { PurposeOfUse: Code } => {
  return typeof value === "object" && "PurposeOfUse" in value;
};

export function convertSamlHeaderToAttributes(header: SamlHeader): SamlAttributes {
  const attributes = header.Security.Assertion.AttributeStatement.Attribute;

  const getAttributeValue = (name: string): string | undefined => {
    const attribute = attributes.find(attr => attr._Name === name);
    if (!attribute) return undefined;
    if (typeof attribute.AttributeValue === "string") return attribute.AttributeValue;
    if (isTextSchema(attribute.AttributeValue)) return extractText(attribute.AttributeValue);
    return undefined;
  };

  const getRoleAttributeValue = (name: string): { code: string; display: string } | undefined => {
    const attribute = attributes.find(attr => attr._Name === name);
    if (!attribute) return undefined;
    if (isRoleObject(attribute.AttributeValue)) {
      return {
        code: attribute.AttributeValue.Role._code,
        display: attribute.AttributeValue.Role._displayName,
      };
    }
    return undefined;
  };

  const getPurposeOfUseAttributeValue = (name: string): string | undefined => {
    const attribute = attributes.find(attr => attr._Name === name);
    if (!attribute) return undefined;
    if (isPurposeOfUseObject(attribute.AttributeValue)) {
      return attribute.AttributeValue.PurposeOfUse._code;
    }
    return undefined;
  };

  const subjectId = getAttributeValue("urn:oasis:names:tc:xspa:1.0:subject:subject-id");
  if (!subjectId) {
    throw new Error("Subject ID is required");
  }

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
  if (!subjectRole) {
    throw new Error("Subject role is required");
  }

  const purposeOfUse = getPurposeOfUseAttributeValue(
    "urn:oasis:names:tc:xspa:1.0:subject:purposeofuse"
  );
  if (purposeOfUse != treatmentPurposeOfUse) {
    throw new Error("A treatment purpose of use is required");
  }

  return {
    subjectId: subjectId,
    organization: organization,
    organizationId: organizationId,
    homeCommunityId: homeCommunityId,
    subjectRole: subjectRole,
    purposeOfUse: purposeOfUse,
  };
}

export function extractTimestamp(header: SamlHeader): string {
  return header.Security.Timestamp.Created;
}
