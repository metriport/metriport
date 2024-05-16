// This is a helper script that lets you test constructing your own soap+saml requests. It creates the SOAP Envelope and then sends it to the gateway specified in the request body.
// npm run saml-server and then reference the Metriport- IHE GW / XML + SAML Constructor - Postman collection
import * as dotenv from "dotenv";
dotenv.config();
import { v4 as uuidv4 } from "uuid";
import express from "express";
import { json, Request, Response } from "express";
import { DocumentReference } from "@metriport/ihe-gateway-sdk";
import { getEnvVarOrFail } from "@metriport/core/util/env-var";
import { createAndSignBulkXCPDRequests } from "@metriport/core/external/carequality/ihe-gateway-v2/outbound/xcpd/create/iti55-envelope";
import { createAndSignBulkDQRequests } from "@metriport/core/external/carequality/ihe-gateway-v2/outbound/xca/create/iti38-envelope";
import { createAndSignBulkDRRequests } from "@metriport/core/external/carequality/ihe-gateway-v2/outbound/xca/create/iti39-envelope";
import { sendSignedXCPDRequests } from "@metriport/core/external/carequality/ihe-gateway-v2/outbound/xcpd/send/xcpd-requests";
import { sendSignedDQRequests } from "@metriport/core/external/carequality/ihe-gateway-v2/outbound/xca/send/dq-requests";
import { sendSignedDRRequests } from "@metriport/core/external/carequality/ihe-gateway-v2/outbound/xca/send/dr-requests";
import { processXCPDResponse } from "@metriport/core/external/carequality/ihe-gateway-v2/outbound/xcpd/process/xcpd-response";
import { processDQResponse } from "@metriport/core/external/carequality/ihe-gateway-v2/outbound/xca/process/dq-response";
import { processDRResponse } from "@metriport/core/external/carequality/ihe-gateway-v2/outbound/xca/process/dr-response";

const app = express();
const port = 8043;
app.use(json());

const samlCertsAndKeys = {
  publicCert: getEnvVarOrFail("CQ_ORG_CERTIFICATE_STAGING"),
  privateKey: getEnvVarOrFail("CQ_ORG_PRIVATE_KEY_STAGING"),
  privateKeyPassword: getEnvVarOrFail("CQ_ORG_PRIVATE_KEY_PASSWORD_STAGING"),
  certChain: getEnvVarOrFail("CQ_ORG_CERTIFICATE_INTERMEDIATE_STAGING"),
};

app.post("/xcpd", async (req: Request, res: Response) => {
  if (!req.is("application/json")) {
    return res.status(400).send({ detail: "Invalid content type. Expected 'application/json'." });
  }

  try {
    const xmlResponses = createAndSignBulkXCPDRequests(req.body, samlCertsAndKeys);
    const response = await sendSignedXCPDRequests({
      signedRequests: xmlResponses,
      samlCertsAndKeys,
      patientId: uuidv4(),
      cxId: uuidv4(),
    });
    const results = response.map(response => {
      return processXCPDResponse({
        xcpdResponse: response,
      });
    });

    res.type("application/json").send(results);
  } catch (error) {
    console.log(error);
    res.status(500).send({ detail: "Internal Server Error" });
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});

app.post("/xcadq", async (req: Request, res: Response) => {
  if (!req.is("application/json")) {
    return res.status(400).send({ detail: "Invalid content type. Expected 'application/json'." });
  }

  try {
    const xmlResponses = createAndSignBulkDQRequests({
      bulkBodyData: req.body,
      samlCertsAndKeys,
    });
    const responses = await sendSignedDQRequests({
      signedRequests: xmlResponses,
      samlCertsAndKeys,
      patientId: uuidv4(),
      cxId: uuidv4(),
    });

    const results = responses.map(response => {
      return processDQResponse({
        dqResponse: response,
      });
    });

    res.type("application/json").send(results);
  } catch (error) {
    res.status(500).send({ detail: "Internal Server Error" });
  }
});

app.post("/xcadr", async (req: Request, res: Response) => {
  if (!req.is("application/json")) {
    return res.status(400).send({ detail: "Invalid content type. Expected 'application/json'." });
  }

  req.body[0].documentReference = req.body[0].documentReference.map((doc: DocumentReference) => ({
    ...doc,
    metriportId: uuidv4(),
  }));

  try {
    const xmlResponses = createAndSignBulkDRRequests({
      bulkBodyData: req.body,
      samlCertsAndKeys,
    });
    const response = await sendSignedDRRequests({
      signedRequests: xmlResponses,
      samlCertsAndKeys,
      patientId: uuidv4(),
      cxId: uuidv4(),
    });

    const results = await Promise.all(
      response.map(async response => {
        return processDRResponse({
          drResponse: response,
        });
      })
    );

    res.type("application/json").send(results);
  } catch (error) {
    res.status(500).send({ detail: "Internal Server Error" });
  }
});
