import { out } from "@metriport/core/util/log";
import { Config } from "../../../shared/config";

export const { log } = out(`CW FHIR proxy`);

export const fhirServerUrl = Config.getFHIRServerUrl();
export const pathSeparator = "/";
export const binaryResourceName = "Binary";
export const docReferenceResourceName = "DocumentReference";
