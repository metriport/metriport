import {
  Bundle,
  BundleEntry,
  OperationOutcome,
  OperationOutcomeIssue,
  Patient,
  Resource,
} from "@medplum/fhirtypes";
import { MetriportError } from "@metriport/shared";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import { buildConsolidatedBundle } from "../../../command/consolidated/consolidated-create";
import { buildEntryReference, getResourceReferences } from "../shared";
import { buildBundle, buildBundleEntry, parseReferenceString } from "../shared/bundle";
import { OPERATION_OUTCOME_EXTENSION_URL } from "../shared/extensions/extension";

dayjs.extend(utc);

type ValidationResponseError = {
  code: string;
  display: string;
  diagnostics: string;
};

type ValidationResponse = {
  isValid: boolean;
  errors: ValidationResponseError[];
};

export type UploadBundleTransactionResult = {
  outcomesBundle: Bundle<Resource>;
  mergedBundle?: Bundle<Resource>;
};

export function processBundleUploadTransaction(
  incomingBundle: Bundle<Resource>,
  existingBundle: Bundle<Resource> = { resourceType: "Bundle", type: "collection" }
): UploadBundleTransactionResult {
  const transactionResponseBundle = buildTransactionResponseBundle();
  let patientResource: Patient | undefined;

  const referencesMap = new Map<string, string>();
  const resourcesMap = new Map<string, Resource>();

  // Create a map of existing resources and references for quick lookup
  existingBundle.entry?.forEach(entry => {
    const resource = entry.resource;
    const id = resource?.id;
    if (!id) return;
    // We don't need to check whether there are conflicts in the existing bundle since it's created with deduplication
    resourcesMap.set(id, resource);
    referencesMap.set(id, buildEntryReference(resource));
  });

  // Only fill out the references map to allow us to check referential integrity across all resources in the bundle
  incomingBundle.entry?.forEach(entry => {
    const resource = entry.resource;
    const id = resource?.id;
    if (!id) return;
    referencesMap.set(id, buildEntryReference(resource));
  });

  // Now check for referential integrity and conflicts with resources in the existing bundle, and build out the merged bundle
  incomingBundle.entry?.forEach(entry => {
    const resource = entry.resource;
    const id = resource?.id;
    if (!id) return;
    if (resource.resourceType === "Patient") {
      patientResource = resource;
      return;
    }

    const integrity = checkReferentialIntegrity(referencesMap, resource);
    if (integrity.isValid === false) {
      transactionResponseBundle.entry?.push(buildErrorResponse(resource, integrity.errors));
      return;
    }

    const existingResource = resourcesMap.get(id);
    if (existingResource) {
      if (buildEntryReference(existingResource) === buildEntryReference(resource)) {
        // Same ID, same resourceType => update
        resourcesMap.set(id, resource);
        transactionResponseBundle.entry?.push(buildSuccessfulUpdateResponse(resource));
        return;
      } else {
        // Same ID, different resourceType => create. This should never really happen.
        resourcesMap.set(id, resource);
        transactionResponseBundle.entry?.push(buildSuccessfulCreateResponse(resource));
        return;
      }
    } else {
      resourcesMap.set(id, resource);
      transactionResponseBundle.entry?.push(buildSuccessfulCreateResponse(resource));
    }
  });

  const errorOutcomes = transactionResponseBundle.entry?.filter(e => e.response?.status === "400");
  if (errorOutcomes && errorOutcomes.length > 0) {
    return {
      outcomesBundle: {
        ...transactionResponseBundle,
        entry: errorOutcomes,
        total: errorOutcomes.length,
      },
    };
  }

  const outcomesBundle = {
    ...transactionResponseBundle,
    ...(transactionResponseBundle.entry
      ? { total: transactionResponseBundle.entry.length }
      : undefined),
  };

  if (!patientResource) {
    throw new MetriportError("Patient resource not found in upload bundle");
  }

  const mergedEntries = Array.from(resourcesMap.values()).map(r => buildBundleEntry(r));
  const mergedBundle: Bundle<Resource> = buildConsolidatedBundle([
    ...mergedEntries,
    buildBundleEntry(patientResource),
  ]);

  return {
    outcomesBundle,
    mergedBundle,
  };
}

export function buildTransactionResponseBundle(entries: BundleEntry[] = []): Bundle {
  return buildBundle({ type: "transaction-response", entries });
}

function checkReferentialIntegrity(
  referencesMap: Map<string, string>,
  resource: Resource
): ValidationResponse {
  const refStrings = getResourceReferences(resource);
  const errors: ValidationResponseError[] = [];

  for (const refString of refStrings) {
    console.log("refString", refString);
    const refObj = parseReferenceString(refString);
    if (!refObj?.id) continue;

    const existingRef = referencesMap.get(refObj.id);
    console.log("existingRef", existingRef);
    if (!existingRef) {
      errors.push({
        code: "INVALID_REFERENCE",
        display: "Invalid resource reference",
        diagnostics: `Reference "${refObj.reference}" not found in bundle`,
      });
    }
  }

  return { isValid: errors.length === 0, errors };
}

function buildSuccessfulCreateResponse(
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

function buildSuccessfulUpdateResponse(resource: Resource): BundleEntry<OperationOutcome> {
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

function buildErrorResponse(
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

function buildOperationOutcomeIssues(errors: ValidationResponseError[]): OperationOutcomeIssue[] {
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
