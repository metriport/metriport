import * as Sentry from "@sentry/serverless";
import { capture } from "./shared/capture";
import { APIGatewayProxyEvent } from "aws-lambda";
import {
  parseXmlStringForRootExtensionSignature,
  generateTimeStrings,
  fillTemplate,
  parseXmlStringForPatientData,
} from "@metriport/core/external/carequality/xcpd-parsing";
import { xcpdTemplate } from "@metriport/core/external/carequality/xcpd-template";

// Keep this as early on the file as possible
capture.init();

const buildResponse = (status: number, body?: unknown) => ({
  statusCode: status,
  headers: { "Content-Type": "application/soap+xml; charset=utf-8" },
  body,
});

export const handler = Sentry.AWSLambda.wrapHandler(async (req: APIGatewayProxyEvent) => {
  // just log the payload for now
  console.log(JSON.stringify(req));
  if (req.body) {
    return parseXmlStringForPatientData(req.body)
      .then(patientData => {
        if (req.body) {
          return parseXmlStringForRootExtensionSignature(req.body).then(
            ([root, extension, signature]: [string, string, string]) => {
              const { createdAt, expiresAt, creationTime } = generateTimeStrings();
              const xcpd = fillTemplate(
                xcpdTemplate,
                createdAt,
                expiresAt,
                creationTime,
                root,
                extension,
                signature,
                patientData
              );
              console.log("xcpd", xcpd);
              return buildResponse(200, xcpd);
            }
          );
        }
      })
      .catch((err: Error) => {
        console.log("error", err);
        return buildResponse(500, { error: err.message });
      });
  }
});
