import express from "express";
import { json, Request, Response } from "express";
import { createSoapEnvelope } from "@metriport/core/external/carequality/saml/xcpd/envelope";
import { verifyXmlSignatures } from "@metriport/core/external/carequality/saml/security/verify";
import {
  signTimestamp,
  signEnvelope,
} from "@metriport/core/external/carequality/saml/security/sign";
import { getEnvVarOrFail } from "@metriport/core/util/env-var";

import * as dotenv from "dotenv";
dotenv.config();

const app = express();
const port = 8043;
app.use(json());

const privateKey = getEnvVarOrFail("IHE_STAGING_KEY");
const x509CertPem = getEnvVarOrFail("IHE_STAGING_CERT");

app.post("/xcpd", async (req: Request, res: Response) => {
  if (!req.is("application/json")) {
    return res.status(400).send({ detail: "Invalid content type. Expected 'application/json'." });
  }

  try {
    const xmlString = createSoapEnvelope(req.body, x509CertPem);
    const signedTimestamp = signTimestamp(xmlString, privateKey);
    const signedTimestampAndEnvelope = signEnvelope(signedTimestamp.getSignedXml(), privateKey);
    const verified = await verifyXmlSignatures(
      signedTimestampAndEnvelope.getSignedXml(),
      x509CertPem
    );
    console.log("Signatures verified: ", verified);

    res.type("application/xml").send(signedTimestampAndEnvelope.getSignedXml());
  } catch (error) {
    console.error(error);
    res.status(500).send({ detail: "Internal Server Error" });
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
