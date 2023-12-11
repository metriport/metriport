import * as Sentry from "@sentry/serverless";
import { capture } from "./shared/capture";
import { APIGatewayProxyEvent } from "aws-lambda";
import express from "express";
import * as serverless from "aws-serverless-express";
import { generateITI38 } from "@metriport/core/external/carequality/iti-38-parsing";
import { generateITI39 } from "@metriport/core/external/carequality/iti-39-parsing";
import { generateXCPD } from "@metriport/core/external/carequality/iti-55-parsing";

const app = express();
const server = serverless.createServer(app);
capture.init();

const buildResponse = (status: number, body?: unknown) => ({
  statusCode: status,
  headers: { "Content-Type": "application/soap+xml; charset=utf-8" },
  body,
});

app.post("/xcpd/v1", req => {
  generateXCPD(req.body)
    .then((xcpd: string) => {
      return buildResponse(200, xcpd);
    })
    .catch((err: Error) => {
      console.log("error", err);
    });
});

app.post("/iti38/v1", req => {
  generateITI38(req.body)
    .then((iti38: string) => {
      return buildResponse(200, iti38);
    })
    .catch((err: Error) => {
      console.log("error", err);
      return buildResponse(404, "No document id matching");
    });
});

app.post("/iti39/v1", req => {
  generateITI39(req.body)
    .then((iti39: string) => {
      return buildResponse(200, iti39);
    })
    .catch((err: Error) => {
      console.log("error", err);
      return buildResponse(404, "No document id matching");
    });
});

export const handler = Sentry.AWSLambda.wrapHandler(
  async (event: APIGatewayProxyEvent, context) => {
    return serverless.proxy(server, event, context);
  }
);
