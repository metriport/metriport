import { errorToString, MetriportError } from "@metriport/shared";
import { isZodError } from "@metriport/shared/util/zod";
import { SamlHeaderBase } from "../../schema";
import { parseHeaderFromRequest } from "../shared";
import { createSoapFault } from "./soap-fault";

/**
 * Checks if an error is a signature verification error.
 */
function isSignatureVerificationError(error: unknown): boolean {
  if (error instanceof MetriportError || error instanceof Error) {
    return error.message.includes("SAML signature verification failed");
  }
  return false;
}

/**
 * Creates a SOAP fault response for eHex errors.
 * Per eHex Security Tests documentation, we must return SOAP faults
 * with MP: MA Fault (Both) Message Parameters for internal errors.
 *
 * @param error - The error that occurred
 * @param isClientError - Whether this is a client error (schema validation) vs server error
 * @param requestBody - Optional request body to extract WS-Addressing headers
 */
function createEhexErrorResponse({
  header,
  errorMessage,
  isClientError,
}: {
  header: SamlHeaderBase;
  errorMessage: string;
  isClientError: boolean;
}): string {
  const faultParams: {
    header: SamlHeaderBase;
    faultString: string;
    faultCode: string;
    detail: string;
  } = {
    header,
    faultString: errorMessage,
    faultCode: isClientError ? "soap:Sender" : "soap:Receiver",
    detail: "MP: MA Fault (Both) Message Parameters",
  };

  return createSoapFault(faultParams);
}

/**
 * Handles errors for gateway requests.
 * Returns a SOAP fault response for eHex errors.
 *
 * Per eHex requirements (conveyed through email), we must return SOAP faults with
 * a header that includes the original MessageID and Action.
 *
 * @param error - The error that occurred
 * @param request - The request body
 * @returns The status code and response
 */
export function handleGatewayError(
  error: unknown,
  request: string
): {
  statusCode: number;
  response: string;
} {
  const errorWithRequest = error as MetriportError & { originalRequest?: string };
  const requestBody = errorWithRequest.originalRequest ?? request;
  const header = parseHeaderFromRequest(requestBody);
  const isSchemaError = isZodError(error);
  const isSignatureError = isSignatureVerificationError(error);
  const isClientError = isSchemaError || isSignatureError;

  return {
    statusCode: isClientError ? 400 : 500,
    response: createEhexErrorResponse({
      header,
      errorMessage: errorToString(error),
      isClientError,
    }),
  };
}
