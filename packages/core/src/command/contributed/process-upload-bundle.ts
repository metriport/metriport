import { Bundle, Patient, Resource } from "@medplum/fhirtypes";
import { MetriportError } from "@metriport/shared";
import {
  ValidationResponseError,
  buildErrorResponse,
  buildSuccessfulCreateResponse,
  buildSuccessfulUpdateResponse,
  buildTransactionResponseBundle,
  isErrorOutcome,
} from "../../external/fhir/bundle/transaction-response-bundle";
import { buildEntryReference, getResourceReferences } from "../../external/fhir/shared";
import { buildBundleEntry, parseReferenceString } from "../../external/fhir/shared/bundle";
import { buildConsolidatedBundle } from "../consolidated/consolidated-create";

type ValidationResponse = {
  isValid: boolean;
  errors: ValidationResponseError[];
};

export type UploadBundleTransactionResult = {
  outcomesBundle: Bundle<Resource>;
  mergedBundle?: Bundle<Resource>;
};

/**
 * Processes an incoming FHIR bundle upload transaction, validating and merging it with existing resources.
 *
 * This function performs several key operations:
 * 1. Validates referential integrity of all resources in the incoming bundle
 * 2. Handles resource conflicts between incoming and existing bundles
 * 3. Creates a transaction response bundle with operation outcomes
 * 4. Merges valid resources into a single bundle
 *
 * @param incomingBundle - The FHIR bundle containing new resources to be processed
 * @param existingBundle - Optional existing bundle to merge with. Defaults to an empty collection bundle
 * @returns An object containing:
 *   - outcomesBundle: A FHIR bundle containing operation outcomes for each processed resource
 *   - mergedBundle: A FHIR bundle containing all valid resources (only present if no validation errors occurred)
 */
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

  if (!patientResource) {
    throw new MetriportError("Patient resource not found in upload bundle");
  }

  const errorOutcomes = transactionResponseBundle.entry?.filter(isErrorOutcome);
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

function checkReferentialIntegrity(
  referencesMap: Map<string, string>,
  resource: Resource
): ValidationResponse {
  const refStrings = getResourceReferences(resource);
  const errors: ValidationResponseError[] = [];

  for (const refString of refStrings) {
    const refObj = parseReferenceString(refString);
    if (!refObj?.id) continue;

    const existingRef = referencesMap.get(refObj.id);
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
