import * as dotenv from "dotenv";
dotenv.config();
// Keep dotenv import/setup before all other imports
import { makeJwt } from "@metriport/commonwell-sdk/common/make-jwt";
import { PurposeOfUse } from "@metriport/shared";
import { Request } from "express";
import * as jwt from "jsonwebtoken";
import { nanoid } from "nanoid";
import { orgGatewayAuthorizationClientId, orgGatewayAuthorizationClientSecret } from "../../env";

const JWT_SECRET = nanoid();

export function makeToken(req: Request, oid: string, orgName: string): string {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Basic ")) {
    throw new Error("Missing or invalid Authorization header");
  }

  const credentials = Buffer.from(authHeader.substring(6), "base64").toString();
  const [clientId, clientSecret] = credentials.split(":");

  if (
    clientId !== orgGatewayAuthorizationClientId ||
    clientSecret !== orgGatewayAuthorizationClientSecret
  ) {
    throw new Error("Invalid client credentials");
  }

  const grantType = req.body?.grant_type || req.query?.grant_type;
  if (grantType !== "client_credentials") {
    throw new Error("Invalid grant_type. Must be 'client_credentials'");
  }

  const token = makeJwt({
    hmacSecret: JWT_SECRET,
    role: "ict",
    subjectId: `${orgName} System User`,
    orgName,
    oid,
    purposeOfUse: PurposeOfUse.TREATMENT,
  });
  return token;
}

export function verifySignature(req: Request): boolean {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    console.log("No Bearer token found in Authorization header");
    return false;
  }

  const token = authHeader.substring(7);

  try {
    const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ["HS256"] }) as jwt.JwtPayload;

    if (decoded.exp && Date.now() >= decoded.exp * 1000) {
      console.log("Token has expired");
      return false;
    }

    return true;
  } catch (error) {
    console.log("Token verification failed:", error);
    return false;
  }
}
