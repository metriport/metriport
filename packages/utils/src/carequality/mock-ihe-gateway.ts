import * as dotenv from "dotenv";
dotenv.config();
// Keep dotenv import and config before everything else
import { processInboundDqRequest } from "@metriport/core/external/carequality/ihe-gateway-v2/inbound/xca/process/dq-request";
import { processInboundDrRequest } from "@metriport/core/external/carequality/ihe-gateway-v2/inbound/xca/process/dr-request";
import { processInboundXcpdRequest } from "@metriport/core/external/carequality/ihe-gateway-v2/inbound/xcpd/process/xcpd-request";

import express, { Application, Request, Response } from "express";

const app: Application = express();

app.use(express.raw({ type: "application/soap+xml", limit: "2mb" }));

app.post("/v2/patient-discovery", async (req: Request, res: Response) => {
  try {
    const response = processInboundXcpdRequest(req.body.toString());
    res.set("Content-Type", "application/json; charset=utf-8");
    res.send({ response });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (err: any) {
    res.status(400).send(err.message);
  }
});

app.post("/v2/document-query", async (req: Request, res: Response) => {
  try {
    console.log("req.body", req.body);
    const response = processInboundDqRequest(req.body.toString());
    console.log("response", response);
    res.set("Content-Type", "application/json; charset=utf-8");
    res.send({ response });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (err: any) {
    res.status(400).send(err.message);
  }
});

app.post("/v2/document-retrieve", async (req: Request, res: Response) => {
  try {
    const response = processInboundDrRequest(req.body.toString());
    res.set("Content-Type", "application/json; charset=utf-8");
    res.send({ response });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (err: any) {
    res.status(400).send(err.message);
  }
});

app.listen(3000, () => {
  console.log("Server is running on port 3000");
});
