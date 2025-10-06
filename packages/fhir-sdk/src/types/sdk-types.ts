import { Resource, BundleEntry } from "@medplum/fhirtypes";
import { Smart } from "./smart-resources";
import { Interval } from "../utils/interval-tree";
import type { FhirBundleSdk } from "../fhir-bundle-sdk";

/**
 * Validation result interface
 */
export interface ValidationResult {
  hasBrokenReferences: boolean;
  brokenReferences: BrokenReference[];
}

/**
 * Broken reference details interface
 */
export interface BrokenReference {
  sourceResourceId: string;
  sourceResourceType: string;
  referenceField: string;
  reference: string;
}

/**
 * Bundle diff result interface
 */
export interface BundleDiffResult {
  /** Resources that exist in both bundles */
  common: FhirBundleSdk;
  /** Resources that exist only in the base bundle (this bundle) */
  baseOnly: FhirBundleSdk;
  /** Resources that exist only in the parameter bundle */
  parameterOnly: FhirBundleSdk;
}

/**
 * Walk options for reference traversal
 */
export interface WalkOptions {
  /** Maximum depth to traverse (default: Infinity) */
  maxDepth?: number;
  /** Include the starting resource in results (default: true) */
  includeStartResource?: boolean;
}

/**
 * Options for generating LLM context
 */
export interface LLMContextOptions {
  /** Maximum depth to traverse (default: 2) */
  maxDepth?: number;
  /** Include the starting resource in results (default: true) */
  includeStartResource?: boolean;
  /** Output format (default: 'structured-text') */
  format?: "json" | "structured-text";
}

/**
 * Result of walking references
 */
export interface WalkResult<T extends Resource> {
  /** All discovered resources organized by depth level */
  resourcesByDepth: Map<number, Smart<Resource>[]>;
  /** All discovered resources as a flat array */
  allResources: Smart<Resource>[];
  /** The starting resource */
  startResource: Smart<T>;
  /** Number of levels traversed */
  depthReached: number;
}

/**
 * Reverse reference details
 */
export interface ReverseReference {
  sourceResourceId: string;
  sourceResourceType: string;
  referenceField: string;
}

/**
 * Options for reverse reference lookup
 */
export interface ReverseReferenceOptions {
  /** Filter by source resource type */
  resourceType?: string;
  /** Filter by specific reference field */
  referenceField?: string;
}

/**
 * Date index record for interval tree
 */
export interface DateIndexRecord extends Interval<number> {
  resourceId: string;
  resourceType: string;
  dateField: string;
}

/**
 * Options for date range search
 */
export interface DateRangeSearchOptions {
  /** Start date for search range (inclusive) */
  dateFrom: string | Date;
  /** End date for search range (inclusive, defaults to current date if not provided) */
  dateTo?: string | Date;
  /** Filter results by resource types */
  resourceTypes?: string[];
  /** Filter results by specific date fields */
  dateFields?: string[];
}

/**
 * Helper function to get resource identifier from bundle entry
 */
export function getResourceIdentifier(entry: BundleEntry): string | undefined {
  if (entry.resource?.id) {
    return entry.resource.id;
  }
  if (entry.fullUrl) {
    return entry.fullUrl;
  }
  return undefined;
}
