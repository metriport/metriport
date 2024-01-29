import { OperationOutcomeError } from "@medplum/core";
import { ErrorRequestHandler } from "express";
import httpStatus from "http-status";
import { ZodError } from "zod";
import MetriportError from "../../errors/metriport-error";
import { getDetailFromOutcomeError } from "@metriport/core/external/fhir/shared/index";
import { isClientError } from "../../shared/http";
import { capture } from "@metriport/core/util/capture";
import { httpResponseBody } from "../util";
import { isReportClientErrors } from "./report-client-errors";

// Errors in Metriport are based off of https://www.rfc-editor.org/rfc/rfc7807
// This is specifically how the fields are used:
//    - status: numeric HTTP status code; ie 500
//    - name: human-readable description of the status code; ie "INTERNAL_SERVER_ERROR"
//    - title: the specific error description - this shouldn't change between occurences; ie "NotFoundError"
//    - detail: details about this error occurrence; ie "Could not find organization"
const defaultResponseBody = httpResponseBody;

const metriportResponseBody = (err: MetriportError): string => {
  return JSON.stringify({
    ...httpResponseBody({
      status: err.status,
      title: err.name,
      detail: err.message,
      name: httpStatus[err.status],
    }),
  });
};

const zodResponseBody = (err: ZodError): string => {
  const formatted = err.issues.map(i => `${i.message}, on [${i.path}]`);
  return JSON.stringify({
    ...httpResponseBody({
      status: httpStatus.BAD_REQUEST,
      title: "Missing or invalid parameters",
      detail: formatted.join(", "),
      name: httpStatus[httpStatus.BAD_REQUEST],
    }),
  });
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  res.setHeader(`x-sentry-id`, (res as any).sentry || ``);

  if (isReportClientErrors(req) && isClientError(err)) {
    capture.error(err, {
      extra: {
        error: err,
        ...(err instanceof MetriportError ? err.additionalInfo : {}),
      },
    });
  }

  if (err instanceof MetriportError) {
    return res.contentType("json").status(err.status).send(metriportResponseBody(err));
  }
  if (err instanceof ZodError) {
    return res.contentType("json").status(httpStatus.BAD_REQUEST).send(zodResponseBody(err));
  }
  if (err instanceof OperationOutcomeError) {
    const status =
      err.outcome.id === "not-found" ? httpStatus.NOT_FOUND : httpStatus.INTERNAL_SERVER_ERROR;
    if (req.path.includes("fhir/R4")) {
      return res.contentType("json").status(status).send(err.outcome);
    } else {
      const detail = getDetailFromOutcomeError(err);
      if (status > 499) {
        console.log(`Error on FHIR: ${detail}`);
      }
      return res
        .contentType("json")
        .status(status)
        .send(
          httpResponseBody({
            status,
            title: err.name,
            detail,
            name: httpStatus[status],
          })
        );
    }
  }
  if (err.statusCode) {
    return res
      .contentType("json")
      .status(err.statusCode)
      .send({
        ...defaultResponseBody({
          status: err.statusCode,
          title: "MetriportError",
          detail: err.message,
        }),
        name: httpStatus[err.statusCode],
      });
  }
  console.log(`Error: ${err}`);
  const internalErrStatus = httpStatus.INTERNAL_SERVER_ERROR;
  return res
    .contentType("json")
    .status(internalErrStatus)
    .send({
      ...defaultResponseBody({
        status: internalErrStatus,
        title: "InternalServerError",
        detail: "Please try again or reach out to support@metriport.com",
      }),
      name: httpStatus[internalErrStatus],
    });
};
