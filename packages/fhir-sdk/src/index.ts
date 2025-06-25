/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  Bundle,
  BundleEntry,
  DiagnosticReport,
  Encounter,
  Observation,
  Patient,
  Practitioner,
  Resource,
} from "@medplum/fhirtypes";

import {
  SmartResource,
  SmartObservation,
  SmartEncounter,
  SmartDiagnosticReport,
  SmartPatient,
  SmartPractitioner,
  isReferenceMethod,
  getReferenceField,
} from "./types/smart-resources";

// Re-export smart resource types for external use
export {
  SmartResource,
  SmartObservation,
  SmartEncounter,
  SmartDiagnosticReport,
  SmartPatient,
  SmartPractitioner,
} from "./types/smart-resources";

export {
  Patient,
  Observation,
  Encounter,
  DiagnosticReport,
  Practitioner,
  Resource,
} from "@medplum/fhirtypes";

/**
 * Validation result interface
 */
export interface ValidationResult {
  isValid: boolean;
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
 * FHIR Bundle SDK for parsing, querying, and manipulating FHIR bundles with reference resolution
 */
export class FhirBundleSdk {
  private bundle: Bundle;
  private resourcesById: Map<string, Resource> = new Map();
  private resourcesByFullUrl: Map<string, Resource> = new Map();
  private resourcesByType: Map<string, Resource[]> = new Map();

  // Smart resource caching to maintain object identity
  private smartResourceCache: WeakMap<Resource, SmartResource<Resource>> = new WeakMap();

  // Smart array caching to maintain array identity
  private smartArrayCache?: Map<string, SmartResource<Resource>[]>;

  // Circular reference protection
  private resolutionStack = new Set<string>();

  constructor(bundle: Bundle) {
    // FR-1.2: Validate bundle resourceType
    if (bundle.resourceType !== "Bundle") {
      throw new Error("Invalid bundle: resourceType must be 'Bundle'");
    }

    // FR-1.3: Validate bundle type
    if (bundle.type !== "collection") {
      throw new Error("Invalid bundle: type must be 'collection'");
    }

    // FR-1.1, FR-1.4: Initialize bundle and create indexes
    this.bundle = bundle;
    this.buildResourceIndexes();
  }

  /**
   * Build O(1) indexes for resource lookup
   */
  private buildResourceIndexes(): void {
    if (!this.bundle.entry) {
      return;
    }

    for (const entry of this.bundle.entry) {
      if (!entry.resource) {
        continue;
      }

      const resource = entry.resource;

      // Index by resource.id if it exists
      if (resource.id) {
        this.resourcesById.set(resource.id, resource);
      }

      // Index by fullUrl if it exists
      if (entry.fullUrl) {
        this.resourcesByFullUrl.set(entry.fullUrl, resource);
      }

      // Index by resource type for type-specific getters
      const resourceType = resource.resourceType;
      if (!this.resourcesByType.has(resourceType)) {
        this.resourcesByType.set(resourceType, []);
      }
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      this.resourcesByType.get(resourceType)!.push(resource);
    }
  }

  /**
   * Create a smart resource with reference resolution methods
   * FR-5.1: Resources returned by SDK have additional getter methods for each Reference field
   * FR-5.7: Reference resolution operates in O(1) time complexity per reference
   * FR-5.8: Original reference fields remain unchanged
   */
  private createSmartResource<T extends Resource>(resource: T): SmartResource<T> {
    // Check cache first to maintain object identity
    const cached = this.smartResourceCache.get(resource);
    if (cached) {
      return cached as SmartResource<T>;
    }

    const smartResource = new Proxy(resource, {
      get: (target, prop, receiver) => {
        // Handle the smart resource marker
        if (prop === "__isSmartResource") {
          return true;
        }

        // Check if this is a reference method call
        if (typeof prop === "string" && isReferenceMethod(prop, target.resourceType)) {
          return () => this.resolveReference(prop, target);
        }

        // Return original property
        return Reflect.get(target, prop, receiver);
      },

      // Ensure JSON serialization works correctly (FR-5.8)
      ownKeys: target => {
        return Reflect.ownKeys(target).filter(key => key !== "__isSmartResource");
      },

      getOwnPropertyDescriptor: (target, prop) => {
        if (prop === "__isSmartResource") {
          return undefined;
        }
        return Reflect.getOwnPropertyDescriptor(target, prop);
      },
    }) as SmartResource<T>;

    // Cache the smart resource
    this.smartResourceCache.set(resource, smartResource);

    return smartResource;
  }

  /**
   * Resolve a reference method call to actual resources
   * FR-5.2-5.6: Handle different reference types and patterns
   */
  private resolveReference(
    methodName: string,
    resource: Resource
  ): SmartResource<Resource> | SmartResource<Resource>[] | undefined {
    const referenceField = getReferenceField(methodName, resource.resourceType);
    if (!referenceField) {
      return undefined;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const referenceValue = (resource as any)[referenceField];
    if (!referenceValue) {
      // FR-5.6: Return appropriate empty value for missing references
      return this.isArrayReferenceField(referenceField, resource.resourceType) ? [] : undefined;
    }

    // Handle array references
    if (Array.isArray(referenceValue)) {
      const resolvedResources: SmartResource<Resource>[] = [];
      for (const ref of referenceValue) {
        const resolved = this.resolveReferenceObject(ref);
        if (resolved) {
          resolvedResources.push(this.createSmartResource(resolved));
        }
      }
      return resolvedResources;
    }

    // Handle single reference
    const resolved = this.resolveReferenceObject(referenceValue);
    return resolved ? this.createSmartResource(resolved) : undefined;
  }

  /**
   * Resolve a single reference object to a resource
   * FR-5.5: Reference resolution methods handle both resource.id and fullUrl matching
   */
  private resolveReferenceObject(referenceObj: unknown): Resource | undefined {
    if (!referenceObj || typeof referenceObj !== "object" || !("reference" in referenceObj)) {
      return undefined;
    }

    const reference = (referenceObj as { reference: string }).reference;

    // Circular reference protection
    if (this.resolutionStack.has(reference)) {
      return undefined;
    }

    this.resolutionStack.add(reference);

    try {
      // Try to resolve by resource ID (e.g., "Patient/123")
      if (reference.includes("/")) {
        const [, resourceId] = reference.split("/");
        if (resourceId && this.resourcesById.has(resourceId)) {
          return this.resourcesById.get(resourceId);
        }
      }

      // Try to resolve by fullUrl (e.g., "urn:uuid:123")
      if (this.resourcesByFullUrl.has(reference)) {
        return this.resourcesByFullUrl.get(reference);
      }

      return undefined;
    } finally {
      this.resolutionStack.delete(reference);
    }
  }

  /**
   * Check if a reference field expects an array of references
   */
  private isArrayReferenceField(fieldName: string, resourceType: string): boolean {
    // Known array reference fields
    const arrayFields = new Set(["performer", "participant", "result", "generalPractitioner"]);
    return arrayFields.has(fieldName);
  }

  /**
   * Find all Reference fields in a resource recursively
   */
  private findAllReferences(resource: Resource): Array<{ field: string; reference: string }> {
    const references: Array<{ field: string; reference: string }> = [];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function searchObject(obj: any, path = ""): void {
      if (!obj || typeof obj !== "object") {
        return;
      }

      // Check if this object is a Reference
      if (obj.reference && typeof obj.reference === "string") {
        references.push({
          field: path || "reference",
          reference: obj.reference,
        });
        return;
      }

      // Recursively search object properties
      for (const [key, value] of Object.entries(obj)) {
        const currentPath = path ? `${path}.${key}` : key;

        if (Array.isArray(value)) {
          value.forEach((item, index) => {
            searchObject(item, `${currentPath}[${index}]`);
          });
        } else if (value && typeof value === "object") {
          searchObject(value, currentPath);
        }
      }
    }

    searchObject(resource);
    return references;
  }

  /**
   * Check if a reference can be resolved within the bundle
   */
  private canResolveReference(reference: string): boolean {
    // Try to resolve by resource ID (e.g., "Patient/123")
    if (reference.includes("/")) {
      const [, resourceId] = reference.split("/");
      if (resourceId && this.resourcesById.has(resourceId)) {
        return true;
      }
    }

    // Try to resolve by fullUrl (e.g., "urn:uuid:123")
    if (this.resourcesByFullUrl.has(reference)) {
      return true;
    }

    return false;
  }

  /**
   * FR-2.1: Validate all references in the bundle
   * FR-2.2: Identifies references by Resource/id pattern and fullUrl references
   * FR-2.3: Handles both relative and absolute references
   * FR-2.4: Returns validation result with broken reference details
   */
  validateReferences(): ValidationResult {
    const brokenReferences: BrokenReference[] = [];

    if (!this.bundle.entry) {
      return { isValid: true, brokenReferences: [] };
    }

    for (const entry of this.bundle.entry) {
      if (!entry.resource) {
        continue;
      }

      const resource = entry.resource;
      const resourceReferences = this.findAllReferences(resource);

      for (const { field, reference } of resourceReferences) {
        if (!this.canResolveReference(reference)) {
          brokenReferences.push({
            sourceResourceId: resource.id || entry.fullUrl || "unknown",
            sourceResourceType: resource.resourceType,
            referenceField: field,
            reference: reference,
          });
        }
      }
    }

    return {
      isValid: brokenReferences.length === 0,
      brokenReferences: brokenReferences,
    };
  }

  /**
   * FR-3.1: Get resource by ID with type parameter support
   * FR-3.2: Method searches both resource.id and entry.fullUrl for matches
   * FR-3.4: Method returns undefined if resource not found
   * FR-3.5: Lookup operates in O(1) time complexity
   * FR-5.1: Returns smart resource with reference resolution methods
   */
  getResourceById<T extends Resource>(id: string): SmartResource<T> | undefined {
    // First try to find by resource.id
    const resourceById = this.resourcesById.get(id);
    if (resourceById) {
      return this.createSmartResource(resourceById) as unknown as SmartResource<T>;
    }

    // Then try to find by fullUrl
    const resourceByFullUrl = this.resourcesByFullUrl.get(id);
    if (resourceByFullUrl) {
      return this.createSmartResource(resourceByFullUrl) as unknown as SmartResource<T>;
    }

    // Return undefined if not found (FR-3.4)
    return undefined;
  }

  /**
   * Get a Patient resource by ID - specialized method with proper typing
   */
  getPatientById(id: string): SmartPatient | undefined {
    const resource = this.getResourceById(id);
    if (resource && resource.resourceType === "Patient") {
      return resource as SmartPatient;
    }
    return undefined;
  }

  /**
   * Get an Observation resource by ID - specialized method with proper typing
   */
  getObservationById(id: string): SmartObservation | undefined {
    const resource = this.getResourceById(id);
    if (resource && resource.resourceType === "Observation") {
      return resource as SmartObservation;
    }
    return undefined;
  }

  /**
   * Get an Encounter resource by ID - specialized method with proper typing
   */
  getEncounterById(id: string): SmartEncounter | undefined {
    const resource = this.getResourceById(id);
    if (resource && resource.resourceType === "Encounter") {
      return resource as SmartEncounter;
    }
    return undefined;
  }

  /**
   * Type-safe version of getResourceById that validates the resource type at runtime
   * FR-3.1: Get resource by ID with type parameter support and runtime validation
   * FR-3.2: Method searches both resource.id and entry.fullUrl for matches
   * FR-3.4: Method returns undefined if resource not found or type doesn't match
   * FR-3.5: Lookup operates in O(1) time complexity
   * FR-5.1: Returns smart resource with reference resolution methods
   */
  getResourceByIdWithType<T extends Resource>(
    id: string,
    resourceType: string
  ): SmartResource<T> | undefined {
    // First try to find by resource.id
    const resourceById = this.resourcesById.get(id);
    if (resourceById && resourceById.resourceType === resourceType) {
      return this.createSmartResource(resourceById) as unknown as SmartResource<T>;
    }

    // Then try to find by fullUrl
    const resourceByFullUrl = this.resourcesByFullUrl.get(id);
    if (resourceByFullUrl && resourceByFullUrl.resourceType === resourceType) {
      return this.createSmartResource(resourceByFullUrl) as unknown as SmartResource<T>;
    }

    // Return undefined if not found or type doesn't match (FR-3.4)
    return undefined;
  }

  /**
   * FR-4.1: Get all Patient resources
   * FR-4.6: Returns empty array if no resources of that type exist
   * FR-4.7: Uses @medplum/fhirtypes for return type definitions
   * FR-5.1: Returns smart resources with reference resolution methods
   */
  getPatients(): SmartPatient[] {
    const patients = (this.resourcesByType.get("Patient") || []) as Patient[];
    // Cache the smart resource array to maintain object identity
    const cacheKey = "patients";
    if (!this.smartArrayCache) {
      this.smartArrayCache = new Map();
    }
    if (this.smartArrayCache.has(cacheKey)) {
      return this.smartArrayCache.get(cacheKey) as SmartPatient[];
    }
    const smartPatients = patients.map(patient => this.createSmartResource(patient));
    this.smartArrayCache.set(cacheKey, smartPatients);
    return smartPatients;
  }

  /**
   * FR-4.2: Get all Observation resources
   * FR-4.6: Returns empty array if no resources of that type exist
   * FR-4.7: Uses @medplum/fhirtypes for return type definitions
   * FR-5.1: Returns smart resources with reference resolution methods
   */
  getObservations(): SmartObservation[] {
    const observations = (this.resourcesByType.get("Observation") || []) as Observation[];
    return observations.map(observation => this.createSmartResource(observation));
  }

  /**
   * FR-4.3: Get all Encounter resources
   * FR-4.6: Returns empty array if no resources of that type exist
   * FR-4.7: Uses @medplum/fhirtypes for return type definitions
   * FR-5.1: Returns smart resources with reference resolution methods
   */
  getEncounters(): SmartEncounter[] {
    const encounters = (this.resourcesByType.get("Encounter") || []) as Encounter[];
    return encounters.map(encounter => this.createSmartResource(encounter));
  }

  /**
   * FR-4.4: Get all Practitioner resources
   * FR-4.6: Returns empty array if no resources of that type exist
   * FR-4.7: Uses @medplum/fhirtypes for return type definitions
   * FR-5.1: Returns smart resources with reference resolution methods
   */
  getPractitioners(): SmartPractitioner[] {
    const practitioners = (this.resourcesByType.get("Practitioner") || []) as Practitioner[];
    return practitioners.map(practitioner => this.createSmartResource(practitioner));
  }

  /**
   * FR-4.5: Get all DiagnosticReport resources
   * FR-4.6: Returns empty array if no resources of that type exist
   * FR-4.7: Uses @medplum/fhirtypes for return type definitions
   * FR-5.1: Returns smart resources with reference resolution methods
   */
  getDiagnosticReports(): SmartDiagnosticReport[] {
    const reports = (this.resourcesByType.get("DiagnosticReport") || []) as DiagnosticReport[];
    return reports.map(report => this.createSmartResource(report));
  }

  /**
   * Create a new bundle entry from an existing entry, preserving fullUrl
   */
  private createBundleEntry(originalEntry: BundleEntry, resource: Resource): BundleEntry {
    const newEntry: BundleEntry = {
      resource: resource,
    };

    // Preserve original fullUrl if it exists (FR-6.6)
    if (originalEntry.fullUrl) {
      newEntry.fullUrl = originalEntry.fullUrl;
    }

    return newEntry;
  }

  /**
   * Create a new bundle with specified entries, maintaining original metadata
   */
  private createExportBundle(entries: BundleEntry[]): Bundle {
    const exportBundle: Bundle = {
      resourceType: "Bundle",
      type: this.bundle.type,
      entry: entries,
    };

    // Preserve original bundle metadata (FR-6.4)
    if (this.bundle.id) {
      exportBundle.id = this.bundle.id;
    }
    if (this.bundle.meta) {
      exportBundle.meta = { ...this.bundle.meta };
    }
    if (this.bundle.identifier) {
      exportBundle.identifier = this.bundle.identifier;
    }
    if (this.bundle.timestamp) {
      exportBundle.timestamp = this.bundle.timestamp;
    }

    // Update total count (FR-6.4)
    exportBundle.total = entries.length;

    return exportBundle;
  }

  /**
   * Find original bundle entry for a given resource
   */
  private findOriginalEntry(resource: Resource): BundleEntry | undefined {
    if (!this.bundle.entry) {
      return undefined;
    }

    return this.bundle.entry.find(
      entry =>
        entry.resource === resource || (entry.resource?.id && entry.resource.id === resource.id)
    );
  }

  /**
   * FR-6.1: Export subset of resources by their IDs
   * FR-6.4: Exported bundles maintain original bundle metadata but update total count
   * FR-6.5: Exported bundles include only resources that exist in the original bundle
   * FR-6.6: Exported bundles preserve original entry.fullUrl values
   */
  exportSubset(resourceIds: string[]): Bundle {
    const exportEntries: BundleEntry[] = [];

    for (const resourceId of resourceIds) {
      const resource = this.getResourceById(resourceId);
      if (resource) {
        const originalEntry = this.findOriginalEntry(resource);
        if (originalEntry) {
          exportEntries.push(this.createBundleEntry(originalEntry, resource));
        }
      }
      // FR-6.5: Silently skip resources that don't exist
    }

    return this.createExportBundle(exportEntries);
  }

  /**
   * FR-6.2: Export all resources of a specific type
   * FR-6.4: Exported bundles maintain original bundle metadata but update total count
   * FR-6.6: Exported bundles preserve original entry.fullUrl values
   */
  exportByType(resourceType: string): Bundle {
    const resources = this.resourcesByType.get(resourceType) || [];
    const exportEntries: BundleEntry[] = [];

    for (const resource of resources) {
      const originalEntry = this.findOriginalEntry(resource);
      if (originalEntry) {
        exportEntries.push(this.createBundleEntry(originalEntry, resource));
      }
    }

    return this.createExportBundle(exportEntries);
  }

  /**
   * FR-6.3: Export all resources of specified types
   * FR-6.4: Exported bundles maintain original bundle metadata but update total count
   * FR-6.6: Exported bundles preserve original entry.fullUrl values
   */
  exportByTypes(resourceTypes: string[]): Bundle {
    const exportEntries: BundleEntry[] = [];

    for (const resourceType of resourceTypes) {
      const resources = this.resourcesByType.get(resourceType) || [];
      for (const resource of resources) {
        const originalEntry = this.findOriginalEntry(resource);
        if (originalEntry) {
          exportEntries.push(this.createBundleEntry(originalEntry, resource));
        }
      }
    }

    return this.createExportBundle(exportEntries);
  }
}
