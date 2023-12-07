import * as Sentry from "@sentry/serverless";
import { capture } from "./shared/capture";
import { APIGatewayProxyEvent } from "aws-lambda";
import { xcpdTemplate } from "./shared/xcpd-template";
import {
  parseXmlStringForRootExtensionSignature,
  generateTimeStrings,
} from "@metriport/core/external/carequality/xcpd-parsing";

// Keep this as early on the file as possible
capture.init();

const fillTemplate = (
  createdAt: string,
  expiresAt: string,
  creationTime: string,
  root: string,
  extension: string,
  signature: string
) => {
  return xcpdTemplate
    .replace(/{createdAt}/g, createdAt)
    .replace(/{expiresAt}/g, expiresAt)
    .replace(/{creationTime}/g, creationTime)
    .replace(/{root}/g, root)
    .replace(/{extension}/g, extension)
    .replace(/{signature}/g, signature);
};

const buildResponse = (status: number, body?: unknown) => ({
  statusCode: status,
  headers: { "Content-Type": "application/soap+xml; charset=utf-8" },
  body,
});

export const handler = Sentry.AWSLambda.wrapHandler(async (req: APIGatewayProxyEvent) => {
  // just log the payload for now
  console.log(JSON.stringify(req));
  if (req.body) {
    return parseXmlStringForRootExtensionSignature(req.body).then(
      ([root, extension, signature]: [string, string, string]) => {
        console.log("root", root);
        console.log("extension", extension);
        console.log("signature", signature);
        const { createdAt, expiresAt, creationTime } = generateTimeStrings();
        console.log("createdAt", createdAt);
        console.log("expiresAt", expiresAt);
        console.log("creationTime", creationTime);
        const xcpd = fillTemplate(createdAt, expiresAt, creationTime, root, extension, signature);
        console.log("xcpd", xcpd);
        return buildResponse(200, xcpd);
      }
    );
  }
});
