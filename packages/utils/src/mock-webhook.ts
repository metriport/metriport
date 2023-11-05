import * as dotenv from "dotenv";
dotenv.config();

import express, { Application, Request, Response } from "express";
import crypto from "crypto";
import { getEnvVarOrFail } from "@metriport/core/util/env-var";

const app: Application = express();

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: false, limit: "2mb" }));

const wh_key = getEnvVarOrFail("WH_KEY");
const cxId = getEnvVarOrFail("CX_ID");

app.post("/", (req: Request, res: Response) => {
  console.log(`BODY: ${JSON.stringify(req.body, undefined, 2)}`);

  const timestamp = req.headers["x-metriport-timestamp"];
  if (typeof timestamp === "string" && wh_key && req.body.patients) {
    const receivedHash = crypto
      .createHmac("sha256", wh_key)
      .update(cxId)
      .update(JSON.stringify(req.body))
      .update(timestamp)
      .digest("hex");
    const expectedHash = req.headers["x-metriport-signature"];
    console.log(`Received hash: ${receivedHash}`);
    console.log(`Expected hash: ${expectedHash}`);
    console.log(`Hashes are ${receivedHash === expectedHash ? "the same" : "different"}`);
  }

  if (req.body.ping) {
    console.log(`Sending 200 | OK + 'pong' body param`);
    return res.status(200).send({ pong: req.body.ping });
  }
  console.log(`Sending 200 | OK`);
  res.sendStatus(200);
});

const port = 8088;
app.listen(port, "0.0.0.0", async () => {
  console.log(`[server]: Webhook mock server is running on port ${8088}`);
});
