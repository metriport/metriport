import { OperationOutcomeError } from "@medplum/core";
import { capitalize, groupBy } from "lodash";
import { Extras } from "@sentry/types";
import { capture } from "@metriport/core/util/notifications";
import { out } from "@metriport/core/util/log";
import ConversionError from "../../../errors/conversion-error";

const timeoutCodes = ["UND_ERR_CONNECT_TIMEOUT", "UND_ERR_HEADERS_TIMEOUT"];

// HAPI specific regex
const conversionRegex = /(element=[\\"]+(\w+)[\\"].+)?Unknown (\w+) code '(\w+)'/;

export type FhirErrorMapping = {
  resourceType: string;
  element?: string;
  invalidValue: string;
  originalError: string;
};
export type FhirError =
  | {
      type: "mapping";
      errors: FhirErrorMapping[];
    }
  | {
      type: "timeout" | "unknown";
    };
export type FhirErrorGroup = Partial<Record<string, FhirErrorMapping[]>>;

export function tryDetermineFhirError(error: unknown): FhirError {
  if (error instanceof OperationOutcomeError) {
    const issues = error.outcome.issue ?? [];
    return {
      type: "mapping",
      errors: issues
        .map(i => tryDetermineFhirError(i.diagnostics))
        .flatMap(e => (e.type === `mapping` && e.errors ? e.errors : [])),
    };
  }
  const unknown = { type: "unknown" } as const;
  const errorString = String(error);
  const matchedConversionErrors = errorString.match(conversionRegex);
  if (matchedConversionErrors) {
    const [, , element, resourceType, code] = matchedConversionErrors;
    if (!resourceType || !code) return unknown;
    const resourceTypeParsed = element
      ? resourceType.replace(capitalize(element), "")
      : resourceType;
    return {
      type: "mapping",
      errors: [
        {
          resourceType: resourceTypeParsed,
          element,
          invalidValue: code,
          originalError: errorString,
        },
      ],
    };
  }
  if (timeoutCodes.some(c => errorString.includes(c))) {
    return { type: "timeout" };
  }
  return unknown;
}

export function groupFHIRErrors(errors: FhirErrorMapping[]): FhirErrorGroup {
  const getKey = (mapping: FhirErrorMapping): string =>
    mapping.resourceType + (mapping.element ? `.${mapping.element}` : ``);
  return groupBy(errors, getKey);
}

export function reportFHIRError({
  docId,
  error,
  context,
  log,
  extra,
}: {
  docId: string;
  error: unknown;
  context: string;
  log: ReturnType<typeof out>["log"];
  extra: Extras;
}) {
  const errorTitle = `CDA>FHIR ${context}`;

  const mappingError = tryDetermineFhirError(error);
  if (mappingError.type === "mapping") {
    const mappedErrors = mappingError.errors;
    const groupedErrors = groupFHIRErrors(mappedErrors);
    for (const [group, errors] of Object.entries(groupedErrors)) {
      const msg = `${errorTitle} - ${group}`;
      log(`${msg} (docId ${docId}): ${msg}, errors: `, errors);
      capture.error(new ConversionError(msg, error), {
        extra: {
          ...extra,
          errors,
        },
      });
    }
  } else {
    log(`${errorTitle} (docId ${docId}): ${error}`);
    capture.error(new ConversionError(errorTitle, error), { extra });
  }
}
