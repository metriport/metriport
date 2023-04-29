import { ErrorRequestHandler } from "express";
import status from "http-status";
import { ZodError } from "zod";
import MetriportError from "./errors/metriport-error";
import { httpResponseBody } from "./routes/util";

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
    }),
    name: status[err.status],
  });
};

const zodResponseBody = (err: ZodError): string => {
  const formatted = err.issues.map(i => `${i.message}, on [${i.path}]`);
  return JSON.stringify({
    ...httpResponseBody({
      status: status.BAD_REQUEST,
      title: "Missing or invalid parameters",
      detail: formatted.join(", "),
    }),
    name: status[status.BAD_REQUEST],
  });
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  res.setHeader(`x-sentry-id`, (res as any).sentry || ``);
  if (err instanceof MetriportError) {
    return res.contentType("json").status(err.status).send(metriportResponseBody(err));
  }
  if (err instanceof ZodError) {
    return res.contentType("json").status(status.BAD_REQUEST).send(zodResponseBody(err));
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
        name: status[err.statusCode],
      });
  }
  console.log(`Error: `, err);
  return res
    .contentType("json")
    .status(status.INTERNAL_SERVER_ERROR)
    .send({
      ...defaultResponseBody({
        status: status.INTERNAL_SERVER_ERROR,
        title: "InternalServerError",
        detail: "Please try again or reach out to support@metriport.com",
      }),
      name: status[status.INTERNAL_SERVER_ERROR],
    });
};
