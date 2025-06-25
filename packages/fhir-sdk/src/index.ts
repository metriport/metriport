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
   */
  getResourceById<T extends Resource>(id: string): T | undefined {
    // First try to find by resource.id
    const resourceById = this.resourcesById.get(id);
    if (resourceById) {
      return resourceById as T;
    }

    // Then try to find by fullUrl
    const resourceByFullUrl = this.resourcesByFullUrl.get(id);
    if (resourceByFullUrl) {
      return resourceByFullUrl as T;
    }

    // Return undefined if not found (FR-3.4)
    return undefined;
  }

  /**
   * FR-4.1: Get all Patient resources
   * FR-4.6: Returns empty array if no resources of that type exist
   * FR-4.7: Uses @medplum/fhirtypes for return type definitions
   */
  getPatients(): Patient[] {
    return (this.resourcesByType.get("Patient") || []) as Patient[];
  }

  /**
   * FR-4.2: Get all Observation resources
   * FR-4.6: Returns empty array if no resources of that type exist
   * FR-4.7: Uses @medplum/fhirtypes for return type definitions
   */
  getObservations(): Observation[] {
    return (this.resourcesByType.get("Observation") || []) as Observation[];
  }

  /**
   * FR-4.3: Get all Encounter resources
   * FR-4.6: Returns empty array if no resources of that type exist
   * FR-4.7: Uses @medplum/fhirtypes for return type definitions
   */
  getEncounters(): Encounter[] {
    return (this.resourcesByType.get("Encounter") || []) as Encounter[];
  }

  /**
   * FR-4.4: Get all Practitioner resources
   * FR-4.6: Returns empty array if no resources of that type exist
   * FR-4.7: Uses @medplum/fhirtypes for return type definitions
   */
  getPractitioners(): Practitioner[] {
    return (this.resourcesByType.get("Practitioner") || []) as Practitioner[];
  }

  /**
   * FR-4.5: Get all DiagnosticReport resources
   * FR-4.6: Returns empty array if no resources of that type exist
   * FR-4.7: Uses @medplum/fhirtypes for return type definitions
   */
  getDiagnosticReports(): DiagnosticReport[] {
    return (this.resourcesByType.get("DiagnosticReport") || []) as DiagnosticReport[];
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
