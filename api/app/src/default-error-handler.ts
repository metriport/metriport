import { ErrorRequestHandler } from "express";
import status from "http-status";
import MetriportError from "./errors/metriport-error";
import { ZodError } from "zod";

// https://www.rfc-editor.org/rfc/rfc7807
const defaultResponseBody = ({ status, title }: { status: number; title: string }): string => {
  return JSON.stringify({
    status,
    title,
  });
};
const metriportResponseBody = (err: MetriportError): string => {
  return JSON.stringify({
    status: err.status,
    title: err.message,
    name: err.name,
  });
};
const zodResponseBody = (err: ZodError): string => {
  return JSON.stringify({
    status: status.BAD_REQUEST,
    name: status[status.BAD_REQUEST],
    title: "Missing or invalid parameters",
    details: err.issues,
  });
};

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
