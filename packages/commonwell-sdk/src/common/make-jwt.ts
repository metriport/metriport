import { PurposeOfUse } from "@metriport/shared";
import * as jwt from "jsonwebtoken";
import { validateNPI } from "./validate-npi";

/**
 * For all items in this file:
 * @see https://www.commonwellalliance.org/specification/
 */

/**
 * The SNOMED CT value representing the role that the user is playing when making the request.
 */
const roleClaim = "urn:oasis:names:tc:xacml:2.0:subject:role";
/**
 * The name of the user as required by HIPAA Privacy Disclosure Accounting.
 */
const subjectIdClaim = "urn:oasis:names:tc:xspa:1.0:subject:subject-id";
/**
 * In plain text, the organization that the user belongs to as required by HIPAA Privacy Disclosure
 * Accounting.
 */
const orgNameClaim = "urn:oasis:names:tc:xspa:1.0:subject:organization";
/**
 * A unique identifier for the organization that the user is representing in performing this
 * transaction. The organization ID may be an Object Identifier (OID), or it may be a URL
 * assigned to that organization
 */
const oidClaim = "urn:oasis:names:tc:xspa:1.0:subject:organization-id";
/**
 * The coded representation of the reason for the request.
 */
const purposeOfUseClaim = "urn:oasis:names:tc:xspa:1.0:subject:purposeofuse";
/**
 * Recommended: A National Provider Identifier (NPI) is a unique 10-digit identification number issued
 * to healthcare providers in the United States by the Centers for Medicare and Medicaid Services (CMS).
 * Edge System should send NPI if known.
 */
const npiClaim = "urn:oasis:names:tc:xspa:2.0:subject:npi";
// const payloadHashClaim = "urn:commonwell-alliance:payload-hash";
/**
 * The value shall be the Home Community ID (an Object Identifier) assigned to the Organization
 * that is initiating the request, using the urn format (that is, “urn:oid:” appended with the OID)
 */
const homeCommunityIdClaim = "urn:nhin:names:saml:homeCommunityId";
/**
 * Required for Delegation of Authority (DOA) requests.
 *
 * When sending delegated requests, the delegate organization must include information about the
 * principal  organization.
 *
 * The value MUST be the Directory Entry assigned to the Principal for whom the Delegate is
 * initiating the request, formatted using the FHIR (Fast Healthcare Interoperability Resources)
 * Resource (Reference?) format.
 *
 * Example: "Organization/urn:oid:2.16.840.1.113883.3.7204.1"
 */
const authGrantorClaim = "QueryAuthGrantor";

const TOKEN_EXPIRY_SECONDS = 3600; // 1 hour

/**
 * Creates a JWT Based on the specified parameters as per the CommonWell spec:
 * @see https://www.commonwellalliance.org/specification/
 *
 * @returns The JWT token.
 */
export function makeJwt({
  rsaPrivateKey,
  hmacSecret,
  role,
  subjectId,
  orgName,
  oid,
  homeCommunityId: homeCommunityIdParam,
  purposeOfUse,
  npi,
  authGrantorReference,
}: {
  /**
   * The RSA256 private key corresponding to the specified organization's public key (certificate),
   * used for signing the JWT.
   * If set, the JWT will be signed with the RSA256 algorithm.
   * If not set, hmacSecret must be set.
   */
  rsaPrivateKey?: string;
  /**
   * The HMAC secret to sign the JWT with the HS256 algorithm.
   * If set, the JWT will be signed with the HS256 algorithm.
   * If not set, rsaPrivateKey must be set.
   */
  hmacSecret?: string;
  /**
   * The practitioner role of the entity making this request.
   * Valid role values: https://hl7.org/fhir/R4/valueset-practitioner-role.html
   */
  role: string;
  /**
   * Free text field used for audit purposes. The value should be user ID or user name of staff
   * using the CommonWell enabled system. Can be a system user if the API call is generated from an
   * automated process instead of an actual user.
   */
  subjectId: string;
  /** The organization name for the request, should match the OID in the claims. */
  orgName: string;
  /**
   * OID of the org making the request. CW uses this ID to certificate in order to validate the
   * signature on the token.
   */
  oid: string;
  /**
   * The Home Community OID assigned to the Organization that is initiating the request (the URN
   * "urn:oid" will be automatically appended).
   *
   * If not set, it will be set to the OID of the org making the request.
   */
  homeCommunityId?: string;
  /** The purpose of use (POU) for this request - the reason for the request. */
  purposeOfUse: PurposeOfUse;
  /** Ten digit National Provider Identifier (optional) */
  npi?: string | undefined;
  /**
   * The value MUST be the Directory Entry assigned to the Principal for whom the Delegate is
   * initiating the request, formatted using the FHIR (Fast Healthcare Interoperability Resources)
   * Resource (Reference?) format.
   *
   * Example: "Organization/urn:oid:2.16.840.1.113883.3.7204.1"
   */
  authGrantorReference?: string | undefined;
}): string {
  if (rsaPrivateKey && hmacSecret) {
    throw new Error("Only one of rsaPrivateKey or hmacSecret must be set, not both");
  }
  const secret = rsaPrivateKey ?? hmacSecret;
  if (!secret) {
    throw new Error("Either rsaPrivateKey or hmacSecret must be set");
  }

  if (npi && !validateNPI(npi)) {
    throw new Error(`NPI number ${npi} is not valid!`);
  }

  const urnPrefix = "urn:oid:";
  const homeCommunityId = homeCommunityIdParam ?? oid;
  const homeCommunityIdValue = homeCommunityId.includes(urnPrefix)
    ? homeCommunityId
    : `${urnPrefix}${homeCommunityId}`;

  const jwtToken = jwt.sign(
    {
      [roleClaim]: role,
      [subjectIdClaim]: subjectId,
      [orgNameClaim]: orgName,
      [oidClaim]: oid,
      [purposeOfUseClaim]: purposeOfUse.toString(),
      ...(npi && { [npiClaim]: npi }),
      [homeCommunityIdClaim]: homeCommunityIdValue,
      iss: "self",
      aud: "urn:commonwellalliance.org",
      nbf: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + TOKEN_EXPIRY_SECONDS,
      ...(authGrantorReference && { [authGrantorClaim]: authGrantorReference }),
    },
    secret,
    {
      algorithm: rsaPrivateKey ? "RS256" : "HS256",
      noTimestamp: true, // Don't add the issuedAt claim
    }
  );

  return jwtToken;
}
