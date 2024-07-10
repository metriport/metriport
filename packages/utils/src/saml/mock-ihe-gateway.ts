import * as dotenv from "dotenv";
dotenv.config();
// Keep dotenv import and config before everything else
import { processInboundDqRequest } from "@metriport/core/external/carequality/ihe-gateway-v2/inbound/xca/process/dq-request";
import { processInboundDrRequest } from "@metriport/core/external/carequality/ihe-gateway-v2/inbound/xca/process/dr-request";
import { processInboundXcpdRequest } from "@metriport/core/external/carequality/ihe-gateway-v2/inbound/xcpd/process/xcpd-request";
import { Config } from "@metriport/core/util/config";
import { setS3UtilsInstance as setS3UtilsInstanceForStoringIheRequests } from "@metriport/core/external/carequality/ihe-gateway-v2/monitor/store";
import { MockS3Utils } from "./mock-s3";

const s3utils = new MockS3Utils(Config.getAWSRegion());
setS3UtilsInstanceForStoringIheRequests(s3utils);

import express, { Application, Request, Response } from "express";

const app: Application = express();

app.use(express.raw({ type: "application/soap+xml", limit: "2mb" }));

app.post("/v2/patient-discovery", async (req: Request, res: Response) => {
  try {
    const response = await processInboundXcpdRequest(req.body.toString());
    res.set("Content-Type", "application/json; charset=utf-8");
    res.send({ response });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (err: any) {
    res.status(400).send(err.message);
  }
});

app.post("/v2/document-query", async (req: Request, res: Response) => {
  try {
    const response = await processInboundDqRequest(req.body.toString());
    res.set("Content-Type", "application/json; charset=utf-8");
    res.send({ response });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (err: any) {
    res.status(400).send(err.message);
  }
});

app.post("/v2/document-retrieve", async (req: Request, res: Response) => {
  try {
    const response = await processInboundDrRequest(req.body.toString());
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
