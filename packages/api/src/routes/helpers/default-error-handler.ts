/* eslint-disable @metriport/eslint-rules/no-named-arrow-functions */
import { OperationOutcomeError } from "@medplum/core";
import { getDetailFromOutcomeError } from "@metriport/core/external/fhir/shared/index";
import { capture } from "@metriport/core/util";
import { MetriportError as MetriportErrorFromCore } from "@metriport/core/util/error/metriport-error";
import { out } from "@metriport/core/util/log";
import { MetriportError as MetriportErrorFromShared } from "@metriport/shared";
import { ErrorRequestHandler } from "express";
import httpStatus from "http-status";
import { ZodError } from "zod";
import MetriportError from "../../errors/metriport-error";
import { isClientError } from "../../shared/http";
import { httpResponseBody } from "../util";
import { isReportClientErrors } from "./report-client-errors";
import axios, { AxiosError } from "axios";

const { log } = out(`error-handler`);

// Errors in Metriport are based off of https://www.rfc-editor.org/rfc/rfc7807
// This is specifically how the fields are used:
//    - status: numeric HTTP status code; ie 500
//    - name: human-readable description of the status code; ie "INTERNAL_SERVER_ERROR"
//    - title: the specific error description - this shouldn't change between occurences; ie "NotFoundError"
//    - detail: details about this error occurrence; ie "Could not find organization"
const defaultResponseBody = httpResponseBody;

export function metriportResponseBody(err: MetriportError): string {
  return JSON.stringify({
    ...httpResponseBody({
      status: err.status,
      title: err.name,
      detail: err.message,
      name: httpStatus[err.status],
    }),
    ...(err.additionalInfo && { additionalInfo: err.additionalInfo }),
  });
}

export function zodResponseBody(err: ZodError): string {
  const formatted = err.issues.map(i => `${i.message}, on [${i.path}]`);
  return JSON.stringify({
    ...httpResponseBody({
      status: httpStatus.BAD_REQUEST,
      title: "Missing or invalid parameters",
      detail: formatted.join(", "),
      name: httpStatus[httpStatus.BAD_REQUEST],
    }),
  });
}

/**
 * Only here until we move all MetriportError to the same place
 */
export function isMetriportError(err: unknown): err is MetriportErrorFromShared {
  return (
    err instanceof MetriportError ||
    err instanceof MetriportErrorFromCore ||
    err instanceof MetriportErrorFromShared
  );
}

export function isAxiosError(err: unknown): err is AxiosError {
  return axios.isAxiosError(err);
}

/**
 * Default error handler for the API.
 *
 * For Sentry/capture, see `app.ts`'s usage of `Sentry.Handlers.errorHandler`
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  res.setHeader(`x-sentry-id`, (res as any).sentry || ``);

  // TODO Bring the logic from `app.ts` to here
  if (isClientError(err) && isReportClientErrors(req)) {
    capture.error(err, {
      extra: {
        ...(isMetriportError(err) ? err.additionalInfo : {}),
        error: err,
      },
    });
  }

  if (isMetriportError(err)) {
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
        log(`Error on FHIR: ${detail}`);
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
  const status = err.statusCode || err.status;
  if (status) {
    const axiosPrefix = isAxiosError(err) ? `${err.request?.method} ${err.request?.path} ` : "";
    const detail = axiosPrefix + err.message;
    return res
      .contentType("json")
      .status(status)
      .send({
        ...defaultResponseBody({
          status,
          title: "MetriportError",
          detail,
        }),
        name: httpStatus[status],
      });
  }
  log(`Error: ${err}`);
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
