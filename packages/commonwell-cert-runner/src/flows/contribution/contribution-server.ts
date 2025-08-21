import * as dotenv from "dotenv";
dotenv.config();
// Keep dotenv import/setup before all other imports
import { faker } from "@faker-js/faker";
import { CommonWell } from "@metriport/commonwell-sdk";
import {
  buildBundleEntry,
  buildSearchSetBundle,
} from "@metriport/core/external/fhir/bundle/bundle";
import express, { Application, Request, Response } from "express";
import { contribServerPort, contribServerUrl } from "../../env";
import { makeBinary } from "./binary";
import { makeDocumentReference } from "./document-reference";
import { makeToken, verifySignature } from "./token";

/**
 * The contribution server is a simple HTTP server that handles requests from CommonWell
 * to support the contribution flow.
 *
 * It is used to:
 * - generate the OAuth 2.0 token (POST /oauth/token)
 * - return the list of documents for a given patient (GET /oauth/fhir/DocumentReference)
 * - return the document (GET /oauth/fhir/Binary/:id)
 *
 * See the function initContributionHttpServer() further down for the initialization.
 */
let commonWell: CommonWell;

const app: Application = express();

app.use(express.urlencoded({ extended: false, limit: "2mb" }));
app.use(express.json({ limit: "2mb" }));

/**
 * Endpoint to generate OAuth 2.0 token
 */
app.post(
  "/oauth/token",
  express.urlencoded({ extended: true }),
  (req: Request, res: Response): void => {
    try {
      console.log(`[server] \nToken request`);
      console.log(`[server] >>> Headers: ${JSON.stringify(req.headers, null, 2)}`);
      console.log(`[server] >>> Path: ${req.path}`);
      console.log(`[server] >>> Query: ${JSON.stringify(req.query, null, 2)}`);
      console.log(`[server] >>> Body: ${JSON.stringify(req.body, null, 2)}`);

      const accessToken = makeToken(req, commonWell.oid, commonWell.orgName);

      const oauthResponse = {
        access_token: accessToken,
        token_type: "Bearer",
      };
      res.status(200).json(oauthResponse);
    } catch (error) {
      console.log("[server] Token generation failed:", error);
      res.status(400).json({
        error: "invalid_request",
        error_description: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
);

/**
 * Endpoint to retrieve a DocumentReference resource.
 *
 * Query params provided by CW v2:
 *  "_include": [
 *    "DocumentReference:subject",
 *    "DocumentReference:patient",
 *    "DocumentReference:author",
 *    "DocumentReference:custodian",
 *    "DocumentReference:authenticator",
 *    "DocumentReference:encounter"
 * ],
 * "subject": "<org-oid>|<patient-id>",
 * "patient": "<org-oid>|<patient-id>",
 */
app.get("/oauth/fhir/DocumentReference", async (req: Request, res: Response): Promise<void> => {
  console.log(`[server] \nDocumentReference request`);
  console.log(`[server] >>> Headers: ${JSON.stringify(req.headers, null, 2)}`);
  console.log(`[server] >>> Path: ${req.path}`);
  console.log(`[server] >>> Query: ${JSON.stringify(req.query, null, 2)}`);
  console.log(`[server] >>> Body: ${JSON.stringify(req.body, null, 2)}`);

  if (!verifySignature(req)) {
    console.log(`[server] Token verification failed`);
    res.sendStatus(401);
    return;
  }
  console.log(`[server] Token verification successful!!!`);

  const patientId = (req.query.patient ?? req.query.subject ?? "").toString();
  if (!patientId) {
    console.log(`[server] >>> No patient ID found in query`);
    res.status(400).json(buildResponseMessage("No patient ID found in query"));
    return;
  }

  const binaryId = faker.string.uuid();
  const docRef = makeDocumentReference({
    orgId: commonWell.oid,
    orgName: commonWell.orgName,
    patientId,
    docUrl: contribServerUrl,
    binaryId,
  });
  const entry = buildBundleEntry(docRef);
  const respPayload = buildSearchSetBundle([entry]);

  res.status(200).json(respPayload);
});

/**
 * Endpoint to retrieve a document. This is called after the DocumentReference endpoint,
 * with the ID being the binaryId present on the DocumentReference resource returned by
 * that endpoint.
 */
app.get("/oauth/fhir/Binary/:id", async (req: Request, res: Response): Promise<void> => {
  console.log(`[server] \nBinary request`);
  console.log(`[server] >>> Headers: ${JSON.stringify(req.headers, null, 2)}`);
  console.log(`[server] >>> Path: ${req.path}`);
  console.log(`[server] >>> Query: ${JSON.stringify(req.query, null, 2)}`);
  console.log(`[server] >>> Body: ${JSON.stringify(req.body, null, 2)}`);

  if (!verifySignature(req)) {
    console.log(`[server] Token verification failed`);
    res.sendStatus(401);
    return;
  }
  console.log(`[server] Token verification successful!!!`);

  const binary = makeBinary();

  res.status(200).json(binary);
});

app.use(express.json({ limit: "2mb" }));

app.all("*", async (req: Request, res: Response): Promise<void> => {
  console.log(`[server] \nNOT FOUND`);
  console.log(`[server] >>> Headers: ${JSON.stringify(req.headers, null, 2)}`);
  console.log(`[server] >>> Path: ${req.path}`);
  console.log(`[server] >>> Query: ${JSON.stringify(req.query, null, 2)}`);
  console.log(`[server] >>> Body: ${JSON.stringify(req.body, null, 2)}`);
  res.sendStatus(404);
});

/**
 * Initialize the HTTP server for the contribution flow.
 *
 * @param commonWellParam - The CommonWell instance to use for the contribution flow.
 */
export async function initContributionHttpServer(commonWellParam: CommonWell) {
  commonWell = commonWellParam;

  const port = contribServerPort;
  app.listen(port, "0.0.0.0", async () => {
    console.log(`[server] HTTP server is running on port ${port}`);
  });
}

function buildResponseMessage(message: string) {
  return {
    resourceType: "OperationOutcome",
    issue: [{ severity: "error", code: "invalid", details: { text: message } }],
  };
}
