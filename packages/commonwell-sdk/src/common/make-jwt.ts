import * as jwt from "jsonwebtoken";
import { PurposeOfUse } from "@metriport/shared";
import { validateNPI } from "./validate-npi";

// The parameterized JWT claims
const roleClaim = "urn:oasis:names:tc:xacml:2.0:subject:role";
const subjectIdClaim = "urn:oasis:names:tc:xspa:1.0:subject:subject-id";
const orgNameClaim = "urn:oasis:names:tc:xspa:1.0:subject:organization";
const oidClaim = "urn:oasis:names:tc:xspa:1.0:subject:organization-id";
const purposeOfUseClaim = "urn:oasis:names:tc:xspa:1.0:subject:purposeofuse";
const npiClaim = "urn:oasis:names:tc:xspa:2.0:subject:npi";
const payloadHashClaim = "urn:commonwell-alliance:payload-hash";

/**
 * Creates a JWT Based on the specified parameters as per the CommonWell spec:
 *    https://commonwellalliance.sharepoint.com/sites/ServiceAdopter/SitePages/JWT-Token.aspx
 *
 * @param rsaPrivateKey   The RSA256 private key corresponding to the specified organization's
 *                        public key (certificate) - used for signing the JWT.
 * @param role            The practitioner role of the entity making this request. Valid role
 *                        values: https://hl7.org/fhir/R4/valueset-practitioner-role.html
 * @param subjectId       Free text field used for audit purposes. The value should be user ID or
 *                        user name of staff using the CommonWell enabled system. Can be a system
 *                        user if the API call is generated from an automated process instead
 *                        of an actual user.
 * @param orgName         The organization name for the request, should match the OID in the
 *                        claims.
 * @param oid             OID of the org making the request. CW uses this ID to certificate in
 *                        order to validate the signature on the token.
 * @param purposeOfUse    The purpose of use (POU) for this request.
 * @param npi             Ten digit National Provider Identifier (optional).
 * @param payloadHash     Only required for Patient IDLink - MurmurHash2 calculation of HTTP POST
 *                        body (optional).
 * @returns The JWT token.
 */
export async function makeJwt(
  rsaPrivateKey: string,
  role: string,
  subjectId: string,
  orgName: string,
  oid: string,
  purposeOfUse: PurposeOfUse,
  npi?: string,
  payloadHash?: string
): Promise<string> {
  if (npi && !validateNPI(npi)) {
    throw new Error(`NPI number ${npi} is not valid!`);
  }
  const jwtToken: string = await new Promise((resolve, reject) => {
    jwt.sign(
      {
        [roleClaim]: role,
        [subjectIdClaim]: subjectId,
        [orgNameClaim]: orgName,
        [oidClaim]: oid,
        [purposeOfUseClaim]: purposeOfUse.toString(),
        ...(npi && { [npiClaim]: npi }),
        ...(payloadHash && { [payloadHashClaim]: payloadHash }),
      },
      rsaPrivateKey,
      {
        algorithm: "RS256",
        issuer: "self",
        notBefore: "0",
        // Max duration between Not Before and Expiration claims cannot exceed 8 hours.
        expiresIn: "8h",
        audience: "urn:commonwellalliance.org",
        noTimestamp: true,
      },
      function (err, token) {
        if (err || !token) {
          reject(err);
          return;
        }
        resolve(token);
      }
    );
  });

  return jwtToken;
}
