import { Config } from "../../../shared/config";

export const proxyPrefix = `CW FHIR proxy`;

export const fhirServerUrl = Config.getFHIRServerUrl();
export const pathSeparator = "/";
export const binaryResourceName = "Binary";
export const docReferenceResourceName = "DocumentReference";

export const defaultError = {
  resourceType: "OperationOutcome",
  issue: [
    {
      severity: "error",
      code: "processing",
      diagnostics: "Error processing request",
    },
  ],
};
