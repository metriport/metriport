/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  AllergyIntolerance,
  Bundle,
  BundleEntry,
  Composition,
  Condition,
  Coverage,
  DiagnosticReport,
  DocumentReference,
  Encounter,
  FamilyMemberHistory,
  Immunization,
  Location,
  Medication,
  MedicationAdministration,
  MedicationDispense,
  MedicationRequest,
  MedicationStatement,
  Observation,
  Organization,
  Patient,
  Practitioner,
  Procedure,
  RelatedPerson,
  Resource,
  RiskAssessment,
  ServiceRequest,
} from "@medplum/fhirtypes";

import { Smart, getReferenceField, isReferenceMethod } from "./types/smart-resources";

export { Smart } from "./types/smart-resources";

export {
  AllergyIntolerance,
  Bundle,
  Composition,
  Condition,
  Coverage,
  DiagnosticReport,
  DocumentReference,
  Encounter,
  FamilyMemberHistory,
  Immunization,
  Location,
  Medication,
  MedicationAdministration,
  MedicationDispense,
  MedicationRequest,
  MedicationStatement,
  Observation,
  Organization,
  Patient,
  Practitioner,
  Procedure,
  RelatedPerson,
  Resource,
  RiskAssessment,
  ServiceRequest,
} from "@medplum/fhirtypes";

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
 * FHIR Bundle SDK for parsing, querying, and manipulating FHIR bundles with reference resolution
 */
export class FhirBundleSdk {
  private bundle: Bundle;
  private resourcesById: Map<string, Resource> = new Map();
  private resourcesByFullUrl: Map<string, Resource> = new Map();
  private resourcesByType: Map<string, Resource[]> = new Map();

  // Smart resource caching to maintain object identity
  private smartResourceCache: WeakMap<Resource, Smart<Resource>> = new WeakMap();

  // Array caching for type-specific getters to maintain reference identity
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private smartResourceArrayCache: Map<string, Smart<any>[]> = new Map();

  // Circular reference protection
  private resolutionStack = new Set<string>();

  /**
   * Configuration for dynamically generated resource getter methods.
   *
   * Each entry in this array automatically generates both single and collection getter methods.
   *
   * **Example:**
   * ```typescript
   * {
   *   resourceType: 'Patient',
   *   singleGetterMethodName: 'getPatientById',
   *   collectionGetterMethodName: 'getPatients'
   * }
   * ```
   *
   * **Generates the equivalent of:**
   * ```typescript
   * // Single resource getter
   * getPatientById(id: string): Smart<Patient> | undefined {
   *   return this.getResourceByIdAndType<Patient>(id, 'Patient');
   * }
   *
   * // Collection getter
   * getPatients(): Smart<Patient>[] {
   *   return this.getResourcesByType<Patient>('Patient');
   * }
   * ```
   *
   * **Usage:**
   * ```typescript
   * const sdk = await FhirBundleSdk.create(bundle);
   * const patient = sdk.getPatientById('patient-123'); // Smart<Patient> | undefined
   * const allPatients = sdk.getPatients(); // Smart<Patient>[]
   * ```
   *
   * To add a new resource type, simply add a new entry to this array and declare
   * the corresponding method signatures in the class body.
   */
  private static readonly RESOURCE_METHODS = [
    {
      resourceType: "Patient",
      singleGetterMethodName: "getPatientById",
      collectionGetterMethodName: "getPatients",
    },
    {
      resourceType: "Observation",
      singleGetterMethodName: "getObservationById",
      collectionGetterMethodName: "getObservations",
    },
    {
      resourceType: "Encounter",
      singleGetterMethodName: "getEncounterById",
      collectionGetterMethodName: "getEncounters",
    },
    {
      resourceType: "AllergyIntolerance",
      singleGetterMethodName: "getAllergyIntoleranceById",
      collectionGetterMethodName: "getAllergyIntolerances",
    },
    {
      resourceType: "Condition",
      singleGetterMethodName: "getConditionById",
      collectionGetterMethodName: "getConditions",
    },
    {
      resourceType: "Organization",
      singleGetterMethodName: "getOrganizationById",
      collectionGetterMethodName: "getOrganizations",
    },
    {
      resourceType: "Location",
      singleGetterMethodName: "getLocationById",
      collectionGetterMethodName: "getLocations",
    },
    {
      resourceType: "Practitioner",
      singleGetterMethodName: "getPractitionerById",
      collectionGetterMethodName: "getPractitioners",
    },
    {
      resourceType: "DiagnosticReport",
      singleGetterMethodName: "getDiagnosticReportById",
      collectionGetterMethodName: "getDiagnosticReports",
    },
    {
      resourceType: "Composition",
      singleGetterMethodName: "getCompositionById",
      collectionGetterMethodName: "getCompositions",
    },
    {
      resourceType: "Coverage",
      singleGetterMethodName: "getCoverageById",
      collectionGetterMethodName: "getCoverages",
    },
    {
      resourceType: "DocumentReference",
      singleGetterMethodName: "getDocumentReferenceById",
      collectionGetterMethodName: "getDocumentReferences",
    },
    {
      resourceType: "Immunization",
      singleGetterMethodName: "getImmunizationById",
      collectionGetterMethodName: "getImmunizations",
    },
    {
      resourceType: "Medication",
      singleGetterMethodName: "getMedicationById",
      collectionGetterMethodName: "getMedications",
    },
    {
      resourceType: "MedicationRequest",
      singleGetterMethodName: "getMedicationRequestById",
      collectionGetterMethodName: "getMedicationRequests",
    },
    {
      resourceType: "Procedure",
      singleGetterMethodName: "getProcedureById",
      collectionGetterMethodName: "getProcedures",
    },
    {
      resourceType: "FamilyMemberHistory",
      singleGetterMethodName: "getFamilyMemberHistoryById",
      collectionGetterMethodName: "getFamilyMemberHistories",
    },
    {
      resourceType: "MedicationAdministration",
      singleGetterMethodName: "getMedicationAdministrationById",
      collectionGetterMethodName: "getMedicationAdministrations",
    },
    {
      resourceType: "MedicationDispense",
      singleGetterMethodName: "getMedicationDispenseById",
      collectionGetterMethodName: "getMedicationDispenses",
    },
    {
      resourceType: "MedicationStatement",
      singleGetterMethodName: "getMedicationStatementById",
      collectionGetterMethodName: "getMedicationStatements",
    },
    {
      resourceType: "RelatedPerson",
      singleGetterMethodName: "getRelatedPersonById",
      collectionGetterMethodName: "getRelatedPersons",
    },
    {
      resourceType: "RiskAssessment",
      singleGetterMethodName: "getRiskAssessmentById",
      collectionGetterMethodName: "getRiskAssessments",
    },
    {
      resourceType: "ServiceRequest",
      singleGetterMethodName: "getServiceRequestById",
      collectionGetterMethodName: "getServiceRequests",
    },
  ] as const;

  // Static initialization block to generate methods
  static {
    // Generate both single and collection getter methods from unified configuration
    for (const {
      resourceType,
      singleGetterMethodName,
      collectionGetterMethodName,
    } of FhirBundleSdk.RESOURCE_METHODS) {
      // Generate single resource getter (e.g., getPatientById)
      Object.defineProperty(FhirBundleSdk.prototype, singleGetterMethodName, {
        value: function (this: FhirBundleSdk, id: string) {
          return this.getResourceByIdAndType(id, resourceType);
        },
        writable: false,
        configurable: false,
      });

      // Generate collection getter (e.g., getPatients)
      Object.defineProperty(FhirBundleSdk.prototype, collectionGetterMethodName, {
        value: function (this: FhirBundleSdk) {
          return this.getResourcesByType(resourceType);
        },
        writable: false,
        configurable: false,
      });
    }
  }

  private constructor(bundle: Bundle) {
    // FR-1.1, FR-1.4: Initialize bundle and create indexes
    this.bundle = bundle;
    this.buildResourceIndexes();
  }

  /**
   * Create a new FhirBundleSdk instance
   * FR-1.2: Validate bundle resourceType
   * FR-1.3: Validate bundle type
   */
  static async create(bundle: Bundle): Promise<FhirBundleSdk> {
    // FR-1.2: Validate bundle resourceType
    if (bundle.resourceType !== "Bundle") {
      throw new Error("Invalid bundle: resourceType must be 'Bundle'");
    }

    // FR-1.3: Validate bundle type
    if (bundle.type !== "collection") {
      throw new Error("Invalid bundle: type must be 'collection'");
    }

    return new FhirBundleSdk(bundle);
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
  private createSmartResource<T extends Resource>(resource: T): Smart<T> {
    // Check cache first to maintain object identity
    const cached = this.smartResourceCache.get(resource);
    if (cached) {
      return cached as Smart<T>;
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
    }) as Smart<T>;

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
  ): Smart<Resource> | Smart<Resource>[] | undefined {
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
      const resolvedResources: Smart<Resource>[] = [];
      for (const ref of referenceValue) {
        const resolved = this.resolveReferenceObject(ref);
        if (resolved) {
          resolvedResources.push(this.createSmartResource(resolved));
        }
      }
      return resolvedResources;
    }

    // Handle single reference - we know it's not an array at this point
    const resolved = this.resolveReferenceObject(referenceValue);
    if (resolved) {
      // Type assertion is safe here because we've established this is the single reference path
      return this.createSmartResource(resolved) as Smart<Resource>;
    }
    return undefined;
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
  lookForBrokenReferences(): ValidationResult {
    const brokenReferences: BrokenReference[] = [];

    if (!this.bundle.entry) {
      return { hasBrokenReferences: false, brokenReferences: [] };
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
      hasBrokenReferences: brokenReferences.length > 0,
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
  getResourceById<T extends Resource>(id: string): Smart<T> | undefined {
    // First try to find by resource.id
    const resourceById = this.resourcesById.get(id);
    if (resourceById) {
      return this.createSmartResource(resourceById) as unknown as Smart<T>;
    }

    // Then try to find by fullUrl
    const resourceByFullUrl = this.resourcesByFullUrl.get(id);
    if (resourceByFullUrl) {
      return this.createSmartResource(resourceByFullUrl) as unknown as Smart<T>;
    }

    // Return undefined if not found (FR-3.4)
    return undefined;
  }

  /**
   * Generic helper method to get a resource by ID with type validation
   */
  private getResourceByIdAndType<T extends Resource>(
    id: string,
    resourceType: string
  ): Smart<T> | undefined {
    const resource = this.getResourceById(id);
    if (resource && resource.resourceType === resourceType) {
      return resource as Smart<T>;
    }
    return undefined;
  }

  // Dynamically generated methods - see static initialization block below
  getPatientById!: (id: string) => Smart<Patient> | undefined;
  getObservationById!: (id: string) => Smart<Observation> | undefined;
  getEncounterById!: (id: string) => Smart<Encounter> | undefined;
  getAllergyIntoleranceById!: (id: string) => Smart<AllergyIntolerance> | undefined;
  getConditionById!: (id: string) => Smart<Condition> | undefined;
  getOrganizationById!: (id: string) => Smart<Organization> | undefined;
  getLocationById!: (id: string) => Smart<Location> | undefined;
  getPractitionerById!: (id: string) => Smart<Practitioner> | undefined;
  getDiagnosticReportById!: (id: string) => Smart<DiagnosticReport> | undefined;
  getCompositionById!: (id: string) => Smart<Composition> | undefined;
  getCoverageById!: (id: string) => Smart<Coverage> | undefined;
  getDocumentReferenceById!: (id: string) => Smart<DocumentReference> | undefined;
  getImmunizationById!: (id: string) => Smart<Immunization> | undefined;
  getMedicationById!: (id: string) => Smart<Medication> | undefined;
  getMedicationRequestById!: (id: string) => Smart<MedicationRequest> | undefined;
  getProcedureById!: (id: string) => Smart<Procedure> | undefined;
  getFamilyMemberHistoryById!: (id: string) => Smart<FamilyMemberHistory> | undefined;
  getMedicationAdministrationById!: (id: string) => Smart<MedicationAdministration> | undefined;
  getMedicationDispenseById!: (id: string) => Smart<MedicationDispense> | undefined;
  getMedicationStatementById!: (id: string) => Smart<MedicationStatement> | undefined;
  getRelatedPersonById!: (id: string) => Smart<RelatedPerson> | undefined;
  getRiskAssessmentById!: (id: string) => Smart<RiskAssessment> | undefined;
  getServiceRequestById!: (id: string) => Smart<ServiceRequest> | undefined;

  /**
   * Generic helper method to get all resources of a specific type
   * FR-10.1: Returns references to cached objects, not copies
   */
  private getResourcesByType<T extends Resource>(resourceType: string): Smart<T>[] {
    // Check cache first to maintain array reference identity
    const cached = this.smartResourceArrayCache.get(resourceType);
    if (cached) {
      return cached as Smart<T>[];
    }

    const resources = (this.resourcesByType.get(resourceType) || []) as T[];
    const smartResources = resources.map(
      resource => this.createSmartResource(resource) as Smart<T>
    );

    // Cache the array to maintain reference identity
    this.smartResourceArrayCache.set(resourceType, smartResources);

    return smartResources;
  }

  // Dynamically generated array getter methods - see static initialization block below
  getPatients!: () => Smart<Patient>[];
  getObservations!: () => Smart<Observation>[];
  getEncounters!: () => Smart<Encounter>[];
  getPractitioners!: () => Smart<Practitioner>[];
  getDiagnosticReports!: () => Smart<DiagnosticReport>[];
  getAllergyIntolerances!: () => Smart<AllergyIntolerance>[];
  getConditions!: () => Smart<Condition>[];
  getOrganizations!: () => Smart<Organization>[];
  getLocations!: () => Smart<Location>[];
  getCompositions!: () => Smart<Composition>[];
  getCoverages!: () => Smart<Coverage>[];
  getDocumentReferences!: () => Smart<DocumentReference>[];
  getImmunizations!: () => Smart<Immunization>[];
  getMedications!: () => Smart<Medication>[];
  getMedicationRequests!: () => Smart<MedicationRequest>[];
  getProcedures!: () => Smart<Procedure>[];
  getFamilyMemberHistories!: () => Smart<FamilyMemberHistory>[];
  getMedicationAdministrations!: () => Smart<MedicationAdministration>[];
  getMedicationDispenses!: () => Smart<MedicationDispense>[];
  getMedicationStatements!: () => Smart<MedicationStatement>[];
  getRelatedPersons!: () => Smart<RelatedPerson>[];
  getRiskAssessments!: () => Smart<RiskAssessment>[];
  getServiceRequests!: () => Smart<ServiceRequest>[];

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
      type: this.bundle.type || "collection",
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
