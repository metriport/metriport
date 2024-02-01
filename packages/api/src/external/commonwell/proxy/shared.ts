import { Config } from "../../../shared/config";

export const proxyPrefix = `CW FHIR proxy`;

export const fhirServerUrl = Config.getFHIRServerUrl();
export const pathSeparator = "/";
export const binaryResourceName = "Binary";
export const docReferenceResourceName = "DocumentReference";
