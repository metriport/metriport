/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  AllergyIntolerance,
  Bundle,
  BundleEntry,
  CarePlan,
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

import { Smart } from "./types/smart-resources";
import {
  ValidationResult,
  BundleDiffResult,
  WalkOptions,
  LLMContextOptions,
  WalkResult,
  ReverseReference,
  ReverseReferenceOptions,
  DateIndexRecord,
  DateRangeSearchOptions,
  getResourceIdentifier,
} from "./types/sdk-types";
import { IntervalTree } from "./utils/interval-tree";
import { lookForBrokenReferences as lookForBrokenReferencesImpl } from "./internal/validation";
import { parseDate } from "./internal/date-extraction";
import { buildResourceIndexes } from "./internal/indexing";
import { createSmartResource as createSmartResourceImpl } from "./internal/reference-resolution";
import {
  createBundleEntry,
  createExportBundle,
  findOriginalEntry,
} from "./internal/bundle-operations";
import { walkReferences as walkReferencesImpl } from "./internal/graph-traversal";
import {
  stripNonClinicalData,
  generateLLMContext as generateLLMContextImpl,
} from "./internal/llm-context";

/**
 * FHIR Bundle SDK for parsing, querying, and manipulating FHIR bundles with reference resolution
 */
export class FhirBundleSdk {
  private bundle: Bundle;
  private resourcesById: Map<string, Resource> = new Map();
  private resourcesByFullUrl: Map<string, Resource> = new Map();
  private resourcesByType: Map<string, Resource[]> = new Map();

  // Reverse reference index: maps resource ID to resources that reference it
  private reverseReferencesById: Map<string, ReverseReference[]> = new Map();

  // Date range index: interval tree for O(log n + k) date range searches
  private dateRangeIndex: IntervalTree<DateIndexRecord, number> = new IntervalTree();

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
    {
      resourceType: "CarePlan",
      singleGetterMethodName: "getCarePlanById",
      collectionGetterMethodName: "getCarePlans",
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
    this.bundle.total = bundle.entry?.length ?? 0;
    buildResourceIndexes(
      this.bundle,
      this.resourcesById,
      this.resourcesByFullUrl,
      this.resourcesByType,
      this.reverseReferencesById,
      this.dateRangeIndex,
      this.resolutionStack
    );
  }

  get total(): number {
    if (!this.bundle.entry) {
      throw new Error("No valid total - bundle property `entry` is undefined");
    }
    return this.bundle.entry.length;
  }

  get entry(): BundleEntry[] {
    if (!this.bundle.entry) {
      console.error("Bundle property `entry` is undefined");
      return [];
    }
    return this.bundle.entry;
  }

  toObject(): Bundle {
    return this.bundle;
  }

  /**
   * Strip non-clinical metadata from a FHIR resource to reduce noise for LLM consumption.
   * Removes: meta, extension, modifierExtension, text, id, identifier, and all reference fields
   * Returns an immutable copy without mutating the original.
   */
  static stripNonClinicalData<T extends Resource>(resource: T): T {
    return stripNonClinicalData(resource);
  }

  /**
   * Create a new FhirBundleSdk instance (async for backwards compatibility)
   * FR-1.2: Validate bundle resourceType
   */
  static async create(bundle: Bundle): Promise<FhirBundleSdk> {
    return FhirBundleSdk.createSync(bundle);
  }

  /**
   * Create a new FhirBundleSdk instance synchronously
   * FR-1.2: Validate bundle resourceType
   */
  static createSync(bundle: Bundle): FhirBundleSdk {
    // FR-1.2: Validate bundle resourceType
    if (bundle.resourceType !== "Bundle") {
      throw new Error("Invalid bundle: resourceType must be 'Bundle'");
    }

    return new FhirBundleSdk(bundle);
  }

  /**
   * Create a smart resource with reference resolution methods
   * FR-5.1: Resources returned by SDK have additional getter methods for each Reference field
   * FR-5.7: Reference resolution operates in O(1) time complexity per reference
   * FR-5.8: Original reference fields remain unchanged
   */
  private createSmartResource<T extends Resource>(resource: T): Smart<T> {
    return createSmartResourceImpl(
      resource,
      this.smartResourceCache,
      this.resourcesById,
      this.resourcesByFullUrl,
      this.resolutionStack,
      (targetId, options) => this.getResourcesReferencingId(targetId, options)
    );
  }

  /**
   * FR-2.1: Validate all references in the bundle
   * FR-2.2: Identifies references by Resource/id pattern and fullUrl references
   * FR-2.3: Handles both relative and absolute references
   * FR-2.4: Returns validation result with broken reference details
   */
  lookForBrokenReferences(): ValidationResult {
    return lookForBrokenReferencesImpl(this.bundle, this.resourcesById, this.resourcesByFullUrl);
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
  getCarePlans!: () => Smart<CarePlan>[];

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
        const originalEntry = findOriginalEntry(this.bundle, resource);
        if (originalEntry) {
          exportEntries.push(createBundleEntry(originalEntry, resource));
        }
      }
      // FR-6.5: Silently skip resources that don't exist
    }

    return createExportBundle(this.bundle, exportEntries);
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
      const originalEntry = findOriginalEntry(this.bundle, resource);
      if (originalEntry) {
        exportEntries.push(createBundleEntry(originalEntry, resource));
      }
    }

    return createExportBundle(this.bundle, exportEntries);
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
        const originalEntry = findOriginalEntry(this.bundle, resource);
        if (originalEntry) {
          exportEntries.push(createBundleEntry(originalEntry, resource));
        }
      }
    }

    return createExportBundle(this.bundle, exportEntries);
  }

  /**
   * Concatenate entries from another FhirBundleSdk with this bundle
   * Returns a new bundle with combined entries while preserving original metadata
   */
  async concatEntries(otherSdk: FhirBundleSdk): Promise<FhirBundleSdk> {
    const currentEntries = this.bundle.entry || [];
    const otherEntries = otherSdk.bundle.entry || [];

    const combinedEntries = [...currentEntries, ...otherEntries];
    const resultBundle = createExportBundle(this.bundle, combinedEntries);

    return await FhirBundleSdk.create(resultBundle);
  }

  /**
   * Diff this bundle with another FHIR Bundle by comparing resource ids.
   * Returns three FhirBundleSdk instances: common, baseOnly, parameterOnly.
   */
  diff(other: Bundle): Promise<BundleDiffResult>;

  /**
   * Diff this bundle with another FhirBundleSdk by comparing resource ids.
   * Returns three FhirBundleSdk instances: common, baseOnly, parameterOnly.
   */
  diff(other: FhirBundleSdk): Promise<BundleDiffResult>;

  /**
   * Diff this bundle with another bundle or FhirBundleSdk by comparing resource ids.
   * Returns three FhirBundleSdk instances: common, baseOnly, parameterOnly.
   */
  async diff(other: Bundle | FhirBundleSdk): Promise<BundleDiffResult> {
    const baseBundle = this.bundle;
    const parameterBundle = other instanceof FhirBundleSdk ? other.bundle : other;

    const commonEntries: BundleEntry[] = [];
    const baseOnlyEntries: BundleEntry[] = [];
    const parameterOnlyEntries: BundleEntry[] = [];

    // Create maps with resource identifiers (prefer resource.id, fallback to fullUrl)
    const baseResourceIdentifiers = new Map<string, BundleEntry>();
    const parameterResourceIdentifiers = new Map<string, BundleEntry>();

    // Populate base bundle identifiers
    for (const entry of baseBundle?.entry ?? []) {
      const identifier = getResourceIdentifier(entry);
      if (identifier) {
        baseResourceIdentifiers.set(identifier, entry);
      }
    }

    // Populate parameter bundle identifiers
    for (const entry of parameterBundle?.entry ?? []) {
      const identifier = getResourceIdentifier(entry);
      if (identifier) {
        parameterResourceIdentifiers.set(identifier, entry);
      }
    }

    // Find common and base-only resources
    for (const [identifier, entry] of baseResourceIdentifiers.entries()) {
      if (parameterResourceIdentifiers.has(identifier)) {
        commonEntries.push(entry);
      } else {
        baseOnlyEntries.push(entry);
      }
    }

    // Find parameter-only resources
    for (const [identifier, entry] of parameterResourceIdentifiers.entries()) {
      if (!baseResourceIdentifiers.has(identifier)) {
        parameterOnlyEntries.push(entry);
      }
    }

    return {
      common: await FhirBundleSdk.create(createExportBundle(this.bundle, commonEntries)),
      baseOnly: await FhirBundleSdk.create(createExportBundle(this.bundle, baseOnlyEntries)),
      parameterOnly: await FhirBundleSdk.create(
        createExportBundle(this.bundle, parameterOnlyEntries)
      ),
    };
  }

  /**
   * Walk references from a starting resource using BFS traversal.
   * Discovers all reachable resources up to maxDepth levels.
   *
   * @param startResource - The smart resource to start traversal from
   * @param options - Walk options including maxDepth and includeStartResource
   * @returns WalkResult containing all discovered resources organized by depth
   */
  walkReferences<T extends Resource>(
    startResource: Smart<T>,
    options?: WalkOptions
  ): WalkResult<T> {
    return walkReferencesImpl(startResource, options);
  }

  /**
   * Generate LLM-friendly context from a starting resource and its related resources.
   * Uses BFS to discover related resources, strips non-clinical data, and formats output.
   *
   * @param startResource - The smart resource to start traversal from
   * @param options - Options for depth, inclusion, and format
   * @returns Formatted string suitable for LLM context
   */
  generateLLMContext<T extends Resource>(
    startResource: Smart<T>,
    options?: LLMContextOptions
  ): string {
    return generateLLMContextImpl(startResource, options, (sr, opts) =>
      this.walkReferences(sr, opts)
    );
  }

  /**
   * Get all resources that reference a given resource ID (reverse reference lookup).
   * Operates in O(1) time complexity.
   *
   * @param targetId - The ID of the resource to find references to
   * @param options - Optional filters for resourceType and referenceField
   * @returns Array of smart resources that reference the target resource
   */
  getResourcesReferencingId<T extends Resource = Resource>(
    targetId: string,
    options?: ReverseReferenceOptions
  ): Smart<T>[] {
    const reverseRefs = this.reverseReferencesById.get(targetId) ?? [];

    let filteredRefs = reverseRefs;

    // Apply resource type filter
    if (options?.resourceType) {
      filteredRefs = filteredRefs.filter(ref => ref.sourceResourceType === options.resourceType);
    }

    // Apply reference field filter
    if (options?.referenceField) {
      filteredRefs = filteredRefs.filter(ref => ref.referenceField === options.referenceField);
    }

    // Convert to smart resources
    const smartResources: Smart<T>[] = [];
    for (const ref of filteredRefs) {
      const resource = this.getResourceById(ref.sourceResourceId);
      if (resource) {
        smartResources.push(resource as Smart<T>);
      }
    }

    return smartResources;
  }

  /**
   * Get all resources referenced by a given resource (forward reference lookup).
   * Returns all resources that the given resource points to based on REFERENCE_METHOD_MAPPING.
   *
   * @param resource - The smart resource to get references from
   * @returns Array of smart resources referenced by the given resource
   */
  getResourcesReferencedBy<T extends Resource = Resource>(resource: Smart<Resource>): Smart<T>[] {
    return resource.getReferencedResources<T>();
  }

  /**
   * Search for resources by date range using interval tree.
   * Operates in O(log n + k) time complexity, where k is the number of matching intervals.
   *
   * @param options - Search options including date range and optional filters
   * @returns Array of smart resources that match the date range criteria
   */
  searchByDateRange<T extends Resource = Resource>(options: DateRangeSearchOptions): Smart<T>[] {
    const { dateFrom, dateTo, resourceTypes, dateFields } = options;

    const fromMs = parseDate(typeof dateFrom === "string" ? dateFrom : dateFrom.toISOString());
    const toMs = parseDate(
      dateTo
        ? typeof dateTo === "string"
          ? dateTo
          : dateTo.toISOString()
        : new Date().toISOString()
    );

    if (fromMs === undefined) {
      throw new Error("Invalid dateFrom parameter");
    }
    if (toMs === undefined) {
      throw new Error("Invalid dateTo parameter");
    }

    const matchingRecords = this.dateRangeIndex.search(fromMs, toMs);

    let filteredRecords = matchingRecords;

    if (resourceTypes && resourceTypes.length > 0) {
      const resourceTypeSet = new Set(resourceTypes);
      filteredRecords = filteredRecords.filter(record => resourceTypeSet.has(record.resourceType));
    }

    if (dateFields && dateFields.length > 0) {
      const dateFieldSet = new Set(dateFields);
      filteredRecords = filteredRecords.filter(record => dateFieldSet.has(record.dateField));
    }

    const resourceIdSet = new Set(filteredRecords.map(record => record.resourceId));

    const smartResources: Smart<T>[] = [];
    for (const resourceId of resourceIdSet) {
      const resource = this.getResourceById(resourceId);
      if (resource) {
        smartResources.push(resource as Smart<T>);
      }
    }

    return smartResources;
  }
}
