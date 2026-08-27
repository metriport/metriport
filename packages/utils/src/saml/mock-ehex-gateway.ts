import * as dotenv from "dotenv";
dotenv.config({ path: ".env.mock-ehex-gateway" });
// Keep dotenv import and config before everything else
import { handleGatewayError } from "@metriport/core/external/ehex/ehex-gateway/inbound/shared/error-handler";
import { processInboundDqRequest } from "@metriport/core/external/ehex/ehex-gateway/inbound/xca/process/dq-request";
import { processInboundDrRequest } from "@metriport/core/external/ehex/ehex-gateway/inbound/xca/process/dr-request";
import { processInboundXcpdRequest } from "@metriport/core/external/ehex/ehex-gateway/inbound/xcpd/process/xcpd-request";
import { setS3UtilsInstance as setS3UtilsInstanceForStoringIheRequests } from "@metriport/core/external/ehex/ehex-gateway/monitor/store";
import { Config } from "@metriport/core/util/config";
import { getEnvVarOrFail } from "@metriport/core/util/env-var";
import { out } from "@metriport/core/util/log";
import { BadRequestError, errorToString } from "@metriport/shared";
import express, { Application, Request, Response } from "express";
import { writeFileSync } from "fs";
import { join } from "path";
import { initRunsFolder } from "../shared/folder";
import { MockS3Utils } from "./mock-s3";

/**
 * This is a mock eHex gateway that can be used to test inbound requests to the eHex gateway.
 *
 * Usage:
 * npm run mock-ehex-gateway
 *
 * Then, you can send requests to the mock eHex gateway at http://localhost:3000/v1/patient-discovery
 */

const s3utils = new MockS3Utils(Config.getAWSRegion());
setS3UtilsInstanceForStoringIheRequests(s3utils);

const apiUrl = getEnvVarOrFail("API_URL");

const runsFolder = initRunsFolder("mock-ehex-gateway");

const app: Application = express();

app.use(
  express.raw({
    type: [
      "application/soap+xml",
      "application/xml",
      "text/xml",
      "multipart/related",
      "application/xop+xml",
    ],
  })
);

function buildResponse(statusCode: number, payload: unknown, res: Response) {
  res.set("Content-Type", "application/soap+xml; charset=utf-8");
  res.status(statusCode).send(payload);
}

app.post("/v1/patient-discovery", async (req: Request, res: Response) => {
  const { log } = out(`/v1/patient-discovery`);
  try {
    const xForwardedFor = Array.isArray(req.headers["x-forwarded-for"])
      ? req.headers["x-forwarded-for"][0]
      : req.headers["x-forwarded-for"];
    const headers = {
      "x-forwarded-for": xForwardedFor?.split(",")[0]?.trim() ?? req.ip ?? req.socket.remoteAddress,
    };

    const { statusCode, payload } = await processInboundXcpdRequest({
      appInstanceId: process.pid.toString(),
      body: req.body.toString(),
      apiUrl,
      headers,
    });
    console.log("PD IS DONE!!!");
    buildResponse(statusCode, payload, res);
    return;
  } catch (error) {
    const errorMessage = errorToString(error);
    const errorDetails = {
      timestamp: new Date().toISOString(),
      error: errorMessage,
      stack: (error as Error).stack,
      requestBody: req.body.toString(),
    };
    const errorFile = join(runsFolder, `error-${Date.now()}.json`);
    writeFileSync(errorFile, JSON.stringify(errorDetails, null, 2));
    console.error(`Error written to ${errorFile}`);
    // TODO ENG-1601 Updated to use the same error handling as the lambda handler, let's decide if we're using those or moving to `handleGatewayError()`
    if (error instanceof BadRequestError) {
      buildResponse(400, errorMessage, res);
      return;
    }
    const msg = "Server error processing event";
    log(`${msg}: ${errorMessage}`);
    buildResponse(500, "Internal Server Error", res);
    return;
  }
});

app.post("/v1/document-query", async (req: Request, res: Response) => {
  try {
    const invocationId = process.pid.toString();
    const xForwardedFor = Array.isArray(req.headers["x-forwarded-for"])
      ? req.headers["x-forwarded-for"][0]
      : req.headers["x-forwarded-for"];
    const headers = {
      "x-forwarded-for": xForwardedFor?.split(",")[0]?.trim() ?? req.ip ?? req.socket.remoteAddress,
    };

    const { statusCode, payload } = await processInboundDqRequest({
      appInstanceId: invocationId,
      body: req.body.toString(),
      headers,
    });
    console.log("DQ IS DONE!!!");
    res.set("Content-Type", "application/soap+xml; charset=utf-8");
    res.status(statusCode).send(payload);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (err: any) {
    const errorMessage = errorToString(err);
    const errorDetails = {
      timestamp: new Date().toISOString(),
      error: errorMessage,
      stack: err.stack,
      requestBody: req.body.toString(),
    };
    const errorFile = join(runsFolder, `error-${Date.now()}.json`);
    writeFileSync(errorFile, JSON.stringify(errorDetails, null, 2));
    console.error(`Error written to ${errorFile}`);
    const { statusCode, response } = handleGatewayError(err, req.body.toString());
    res.set("Content-Type", "application/soap+xml; charset=utf-8");
    res.status(statusCode).send(response);
  }
});

app.post("/v1/document-retrieve", async (req: Request, res: Response) => {
  try {
    const invocationId = process.pid.toString();
    const xForwardedFor = Array.isArray(req.headers["x-forwarded-for"])
      ? req.headers["x-forwarded-for"][0]
      : req.headers["x-forwarded-for"];
    const contentTypeHeader = req.headers["content-type"] ?? req.headers["Content-Type"];
    const contentType = Array.isArray(contentTypeHeader) ? contentTypeHeader[0] : contentTypeHeader;
    const headers = {
      "x-forwarded-for": xForwardedFor?.split(",")[0]?.trim() ?? req.ip ?? req.socket.remoteAddress,
      "content-type": contentType,
    };

    const {
      statusCode,
      payload: responsePayload,
      contentType: responseContentType,
    } = await processInboundDrRequest({
      appInstanceId: invocationId,
      body: req.body,
      isBase64Encoded: false,
      headers,
    });

    res.set("Content-Type", responseContentType);
    res.status(statusCode).send(responsePayload);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (err: any) {
    const errorMessage = errorToString(err);
    const requestBodyString = Buffer.isBuffer(req.body) ? req.body.toString() : String(req.body);
    const errorDetails = {
      timestamp: new Date().toISOString(),
      error: errorMessage,
      stack: err.stack,
      requestBody: requestBodyString,
    };
    const errorFile = join(runsFolder, `error-${Date.now()}.json`);
    writeFileSync(errorFile, JSON.stringify(errorDetails, null, 2));
    console.error(`Error written to ${errorFile}`);
    const { statusCode, response } = handleGatewayError(err, requestBodyString);
    res.set("Content-Type", "application/soap+xml; charset=utf-8");
    res.status(statusCode).send(response);
  }
});

app.listen(3000, () => {
  console.log("Server is running on port 3000");
});
