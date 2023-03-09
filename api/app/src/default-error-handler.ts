import { ErrorRequestHandler } from "express";
import status from "http-status";
import { ZodError } from "zod";
import MetriportError from "./errors/metriport-error";
import { httpResponseBody } from "./routes/util";

// https://www.rfc-editor.org/rfc/rfc7807
const defaultResponseBody = httpResponseBody;

const metriportResponseBody = (err: MetriportError): string => {
  return JSON.stringify({
    ...httpResponseBody({
      status: err.status,
      title: err.message,
    }),
    name: err.name,
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
      .send(
        defaultResponseBody({
          status: err.statusCode,
          title: err.message,
        })
      );
  }
  console.log(`Error: `, err);
  return res
    .contentType("json")
    .status(status.INTERNAL_SERVER_ERROR)
    .send(
      defaultResponseBody({
        status: status.INTERNAL_SERVER_ERROR,
        title: "Internal server error, please try again or reach out to support@metriport.com",
      })
    );
};
