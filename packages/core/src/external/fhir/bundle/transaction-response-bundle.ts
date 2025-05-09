import {
  Bundle,
  BundleEntry,
  OperationOutcome,
  OperationOutcomeIssue,
  Resource,
} from "@medplum/fhirtypes";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import { buildBundle } from "../shared/bundle";
import { OPERATION_OUTCOME_EXTENSION_URL } from "../shared/extensions/extension";

dayjs.extend(utc);

export type ValidationResponseError = {
  code: string;
  display: string;
  diagnostics: string;
};

export function buildTransactionResponseBundle(entries: BundleEntry[] = []): Bundle {
  return buildBundle({ type: "transaction-response", entries });
}

export function buildSuccessfulCreateResponse(
  resource: Resource,
  lastModified = dayjs.utc(new Date()).toISOString()
): BundleEntry<OperationOutcome> {
  const resourceIdentifier = `${resource.resourceType}/${resource.id}/_history/1`;

  return {
    response: {
      status: "201 Created",
      location: resourceIdentifier,
      lastModified,
      outcome: {
        resourceType: "OperationOutcome",
        issue: [
          {
            severity: "information",
            code: "informational",
            details: {
              coding: [
                {
                  system: "https://public.metriport.com/fhir/StructureDefinition/operation-outcome",
                  code: "SUCCESSFUL_UPDATE_AS_CREATE",
                  display: "Update as create succeeded.",
                },
              ],
            },
            diagnostics: `Successfully created resource "${resourceIdentifier}" using update as create (ie. create with client assigned ID).`,
          },
        ],
      },
    },
  };
}

export function buildSuccessfulUpdateResponse(resource: Resource): BundleEntry<OperationOutcome> {
  // TODO: dynamic version number
  const resourceIdentifier = `${resource.resourceType}/${resource.id}/_history/1`;

  return {
    response: {
      status: "200 OK",
      location: resourceIdentifier,
      outcome: {
        resourceType: "OperationOutcome",
        issue: [
          {
            severity: "information",
            code: "informational",
            details: {
              coding: [
                {
                  system: "https://public.metriport.com/fhir/StructureDefinition/operation-outcome",
                  code: "SUCCESSFUL_UPDATE",
                  display: "Update succeeded.",
                },
              ],
            },
            diagnostics: `Successfully updated resource "${resourceIdentifier}".`,
          },
        ],
      },
    },
  };
}

export function buildErrorResponse(
  resource: Resource,
  errors: ValidationResponseError[]
): BundleEntry<OperationOutcome> {
  const resourceIdentifier = `${resource.resourceType}/${resource.id}/_history/1`;
  const issues = buildOperationOutcomeIssues(errors);

  return {
    response: {
      status: "400",
      location: resourceIdentifier,
      outcome: {
        resourceType: "OperationOutcome",
        issue: issues,
      },
    },
  };
}

export function buildOperationOutcomeIssues(
  errors: ValidationResponseError[]
): OperationOutcomeIssue[] {
  return errors.map(e => {
    return {
      severity: "error",
      code: "invalid",
      details: {
        coding: [
          {
            system: OPERATION_OUTCOME_EXTENSION_URL,
            code: e.code,
            display: e.display,
          },
        ],
      },
      diagnostics: e.diagnostics,
    };
  });
}

export function isErrorOutcome(entry: BundleEntry<Resource>): boolean {
  const status = entry.response?.status;
  if (!status) return false;

  const statusNumber = parseInt(status, 10);
  return statusNumber >= 400 && statusNumber < 500;
}
