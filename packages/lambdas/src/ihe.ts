import * as Sentry from "@sentry/serverless";
import { capture } from "./shared/capture";
import { APIGatewayProxyEvent } from "aws-lambda";
import {
  generateXCPD,
  parseXmlStringForPatientData,
  isAnyPatientMatching,
} from "@metriport/core/external/carequality/iti-55-parsing";

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
        const matchingPatient = isAnyPatientMatching(patientData);
        if (matchingPatient) {
          if (req.body) {
            return generateXCPD(req.body, matchingPatient)
              .then((xcpd: string) => {
                return buildResponse(200, xcpd);
              })
              .catch((err: Error) => {
                console.log("error", err);
                return buildResponse(404, "invalid xcpd request");
              });
          }
        } else {
          console.log("no patient matching");
          return buildResponse(404, "No patient matching");
        }
      })
      .catch((err: Error) => {
        console.log("error", err);
        return buildResponse(500, { error: err.message });
      });
  }
});
