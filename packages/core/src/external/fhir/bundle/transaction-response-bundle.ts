import { Bundle, BundleEntry, OperationOutcome, Resource } from "@medplum/fhirtypes";
import { buildBundle, buildReferenceFromStringRelative } from "../shared/bundle";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";

dayjs.extend(utc);

type ValidationResponse = {
  isSuccess: boolean;
  isCreate: boolean;
  error?: {
    code: string;
    display: string;
    diagnostics: string;
  };
};

type ResourceConflict = {
  existingResource: Resource;
  incomingResource: Resource;
};

export function processBundleUploadTransaction(
  incomingBundle: Bundle<Resource>,
  existingBundle: Bundle<Resource> = { resourceType: "Bundle", type: "collection" }
): Bundle<Resource> {
  const transactionResponseBundle = buildTransactionResponseBundle();
  const resourceMap = new Map<string, ResourceConflict>();

  // First, collect all existing resources
  existingBundle.entry?.forEach(entry => {
    if (!entry.resource) return;
    const id = entry.resource.id;
    if (!id) return;

    const resourceKey = id;
    resourceMap.set(resourceKey, {
      existingResource: entry.resource,
      incomingResource: entry.resource,
    });
  });

  // Process incoming resources and check for conflicts
  incomingBundle.entry?.forEach(entry => {
    if (!entry.resource) return;
    const { resourceType, id } = entry.resource;
    if (!id) return;

    const resourceKey = id;
    if (resourceMap.has(resourceKey)) {
      const conflict = resourceMap.get(resourceKey);
      if (!conflict) return;

      const existingType = conflict.existingResource.resourceType;

      if (existingType === resourceType) {
        // Same resource type - update existing with incoming
        resourceMap.set(resourceKey, {
          existingResource: conflict.existingResource,
          incomingResource: entry.resource,
        });
        transactionResponseBundle.entry?.push(buildSuccessfulUpdateResponse(entry.resource));
      }
    } else {
      // No conflict - add to map as both existing and incoming
      resourceMap.set(resourceKey, {
        existingResource: entry.resource,
        incomingResource: entry.resource,
      });
    }
  });

  // Validate referential integrity using the combined resources
  incomingBundle.entry?.forEach(entry => {
    if (!entry.resource) return;
    const resp = checkReferentialIntegrity(resourceMap, entry);
    // Only process successful validations that haven't been handled in conflict resolution
    if (resp.isSuccess) {
      const { id, resourceType } = entry.resource;
      if (resourceType === "Patient") return;
      if (!id) return;

      const conflict = resourceMap.get(id);

      // If this resource wasn't handled in conflict resolution (no update response generated)
      if (conflict?.existingResource === conflict?.incomingResource) {
        if (resp.isCreate) {
          transactionResponseBundle.entry?.push(buildSuccessfulCreateResponse(entry.resource));
        }
      }
    } else if (!resp.isSuccess && resp.error) {
      transactionResponseBundle.entry?.push(buildErrorResponse(entry.resource, resp.error));
    }
  });

  transactionResponseBundle.total = transactionResponseBundle.entry?.length ?? 0;
  return transactionResponseBundle;
}

function buildTransactionResponseBundle(entries: BundleEntry[] = []): Bundle {
  return buildBundle({ type: "transaction-response", entries });
}

function findReferences(resource: Resource): string[] {
  const references: string[] = [];

  // Recursively search for reference properties in the resource
  function traverse(obj: unknown): void {
    if (!obj || typeof obj !== "object") return;

    if ("reference" in obj && typeof obj.reference === "string") {
      references.push(obj.reference);
    }

    Object.values(obj).forEach(traverse);
  }

  traverse(resource);
  return references;
}

function checkReferentialIntegrity(
  resourceMap: Map<string, ResourceConflict>,
  entry: BundleEntry<Resource>
): ValidationResponse {
  if (!entry.resource) {
    return {
      isSuccess: false,
      isCreate: false,
      error: {
        code: "MISSING_RESOURCE",
        display: "Missing resource in bundle entry",
        diagnostics: "Bundle entry must contain a resource",
      },
    };
  }

  const refStrings = findReferences(entry.resource);
  for (const refString of refStrings) {
    const reference = buildReferenceFromStringRelative(refString);
    if (!reference?.id) continue;

    if (!resourceMap.has(reference.id)) {
      return {
        isSuccess: false,
        isCreate: false,
        error: {
          code: "INVALID_REFERENCE",
          display: "Invalid resource reference",
          diagnostics: `Reference "${reference.reference}" not found in bundle`,
        },
      };
    }
  }

  return { isSuccess: true, isCreate: true };
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
  // TODO: dynamic version number ?
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
  error: { code: string; display: string; diagnostics: string }
): BundleEntry<OperationOutcome> {
  const resourceIdentifier = `${resource.resourceType}/${resource.id}/_history/1`;

  return {
    response: {
      status: "400",
      location: resourceIdentifier,
      outcome: {
        resourceType: "OperationOutcome",
        issue: [
          {
            severity: "error",
            code: "invalid",
            details: {
              coding: [
                {
                  system: "https://public.metriport.com/fhir/StructureDefinition/operation-outcome",
                  code: error.code,
                  display: error.display,
                },
              ],
            },
            diagnostics: error.diagnostics,
          },
        ],
      },
    },
  };
}
