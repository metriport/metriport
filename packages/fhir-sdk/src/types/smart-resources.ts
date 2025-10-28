import {
  Resource,
  Patient,
  Observation,
  Encounter,
  Practitioner,
  PractitionerRole,
  Organization,
  CareTeam,
  RelatedPerson,
  DiagnosticReport,
  Group,
  Device,
  Location,
  AllergyIntolerance,
  Condition,
  Composition,
  Coverage,
  DocumentReference,
  FamilyMemberHistory,
  Immunization,
  Medication,
  MedicationAdministration,
  MedicationDispense,
  MedicationRequest,
  MedicationStatement,
  Procedure,
  RiskAssessment,
  ServiceRequest,
  CarePlan,
  Goal,
  Appointment,
  CommunicationRequest,
  DeviceRequest,
  NutritionOrder,
  Task,
  VisionPrescription,
  RequestGroup,
  HealthcareService,
  Substance,
  Coding,
  CodeableConcept,
} from "@medplum/fhirtypes";

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
 * Smart Coding type with enhanced methods for checking coding systems
 */
export interface SmartCoding extends Coding {
  /** Check if this coding belongs to the LOINC system */
  isLoinc(): boolean;
  /** Check if this coding belongs to the ICD-10 system */
  isIcd10(): boolean;
  /** Check if this coding belongs to the SNOMED system */
  isSnomed(): boolean;
  /** Check if this coding belongs to the RxNorm system */
  isRxNorm(): boolean;
  /** Check if this coding belongs to the NDC system */
  isNdc(): boolean;
  /** Check if this coding's code matches a specific code value */
  matchesCode(code: string): boolean;
  /** Check if this coding's code matches any of the provided code values */
  matchesCodes(codes: string[]): boolean;
}

/**
 * Smart CodeableConcept type with enhanced methods for working with coding systems
 */
export interface SmartCodeableConcept extends Omit<CodeableConcept, "coding"> {
  /** Array of smart codings */
  coding?: SmartCoding[];

  // LOINC methods
  /** Get the first LOINC coding */
  getLoinc(): SmartCoding | undefined;
  /** Get all LOINC codings */
  getLoincCodings(): SmartCoding[];
  /** Get the first LOINC code value */
  getLoincCode(): string | undefined;
  /** Get all LOINC code values */
  getLoincCodes(): string[];
  /** Check if this CodeableConcept has any LOINC coding */
  hasLoinc(): boolean;
  /** Check if this CodeableConcept has a specific LOINC code */
  hasLoincCode(code: string): boolean;
  /** Check if this CodeableConcept has any of the provided LOINC codes */
  hasSomeLoinc(codes: string[]): boolean;
  /** Find a LOINC coding matching a predicate */
  findLoincCoding(predicate: (code: string) => boolean): SmartCoding | undefined;

  // ICD-10 methods
  /** Get the first ICD-10 coding */
  getIcd10(): SmartCoding | undefined;
  /** Get all ICD-10 codings */
  getIcd10Codings(): SmartCoding[];
  /** Get the first ICD-10 code value */
  getIcd10Code(): string | undefined;
  /** Get all ICD-10 code values */
  getIcd10Codes(): string[];
  /** Check if this CodeableConcept has any ICD-10 coding */
  hasIcd10(): boolean;
  /** Check if this CodeableConcept has a specific ICD-10 code */
  hasIcd10Code(code: string): boolean;
  /** Check if this CodeableConcept has any of the provided ICD-10 codes */
  hasSomeIcd10(codes: string[]): boolean;
  /** Find an ICD-10 coding matching a predicate */
  findIcd10Coding(predicate: (code: string) => boolean): SmartCoding | undefined;

  // SNOMED methods
  /** Get the first SNOMED coding */
  getSnomed(): SmartCoding | undefined;
  /** Get all SNOMED codings */
  getSnomedCodings(): SmartCoding[];
  /** Get the first SNOMED code value */
  getSnomedCode(): string | undefined;
  /** Get all SNOMED code values */
  getSnomedCodes(): string[];
  /** Check if this CodeableConcept has any SNOMED coding */
  hasSnomed(): boolean;
  /** Check if this CodeableConcept has a specific SNOMED code */
  hasSnomedCode(code: string): boolean;
  /** Check if this CodeableConcept has any of the provided SNOMED codes */
  hasSomeSnomed(codes: string[]): boolean;
  /** Find a SNOMED coding matching a predicate */
  findSnomedCoding(predicate: (code: string) => boolean): SmartCoding | undefined;

  // RxNorm methods
  /** Get the first RxNorm coding */
  getRxNorm(): SmartCoding | undefined;
  /** Get all RxNorm codings */
  getRxNormCodings(): SmartCoding[];
  /** Get the first RxNorm code value */
  getRxNormCode(): string | undefined;
  /** Get all RxNorm code values */
  getRxNormCodes(): string[];
  /** Check if this CodeableConcept has any RxNorm coding */
  hasRxNorm(): boolean;
  /** Check if this CodeableConcept has a specific RxNorm code */
  hasRxNormCode(code: string): boolean;
  /** Check if this CodeableConcept has any of the provided RxNorm codes */
  hasSomeRxNorm(codes: string[]): boolean;
  /** Find a RxNorm coding matching a predicate */
  findRxNormCoding(predicate: (code: string) => boolean): SmartCoding | undefined;

  // NDC methods
  /** Get the first NDC coding */
  getNdc(): SmartCoding | undefined;
  /** Get all NDC codings */
  getNdcCodings(): SmartCoding[];
  /** Get the first NDC code value */
  getNdcCode(): string | undefined;
  /** Get all NDC code values */
  getNdcCodes(): string[];
  /** Check if this CodeableConcept has any NDC coding */
  hasNdc(): boolean;
  /** Check if this CodeableConcept has a specific NDC code */
  hasNdcCode(code: string): boolean;
  /** Check if this CodeableConcept has any of the provided NDC codes */
  hasSomeNdc(codes: string[]): boolean;
  /** Find an NDC coding matching a predicate */
  findNdcCoding(predicate: (code: string) => boolean): SmartCoding | undefined;
}

/**
 * Base interface for smart resources - all smart resources have these capabilities
 */
export interface SmartResourceBase {
  // Marker property to identify smart resources
  readonly __isSmartResource: true;

  /**
   * Get all resources that reference this resource (reverse reference lookup)
   * @param options - Optional filters for resourceType and referenceField
   * @returns Array of smart resources that reference this resource
   */
  getReferencingResources<T extends Resource = Resource>(
    options?: ReverseReferenceOptions
  ): Smart<T>[];

  /**
   * Get all resources referenced by this resource (forward reference lookup)
   * @returns Array of smart resources referenced by this resource based on REFERENCE_METHOD_MAPPING
   */
  getReferencedResources<T extends Resource = Resource>(): Smart<T>[];

  /**
   * Convert the resource to a string representation without proxy limitations
   * @param space - Number of spaces to use for indentation (default: 2)
   * @returns JSON string representation of the resource
   */
  toString(space?: number): string;
}

/**
 * Generic type that converts any Resource to a Smart resource
 * Note: Nested Coding/CodeableConcept wrapping happens at runtime via proxies,
 * not at the type level, to avoid TypeScript structural typing issues
 */
export type Smart<T extends Resource> = T & SmartResourceBase & ReferenceMethodsFor<T>;

/**
 * Reference methods for Observation resources
 */
export interface ObservationReferenceMethods {
  getBasedOn<T extends Resource>(): Smart<T>[];
  getPartOf<T extends Resource>(): Smart<T>[];
  getSubject<T extends Patient | Group | Device | Location>(): Smart<T> | undefined;
  getFocus<T extends Resource>(): Smart<T>[];
  getEncounter(): Smart<Encounter> | undefined;
  getPerformers<
    T extends Practitioner | PractitionerRole | Organization | CareTeam | Patient | RelatedPerson
  >(): Smart<T>[];
  getSpecimen<T extends Resource>(): Smart<T> | undefined;
  getDevice<T extends Device>(): Smart<T> | undefined;
  getHasMember<T extends Resource>(): Smart<T>[];
  getDerivedFrom<T extends Resource>(): Smart<T>[];
}

/**
 * Reference methods for Encounter resources
 */
export interface EncounterReferenceMethods {
  getSubject<T extends Patient | Group>(): Smart<T> | undefined;
  getEpisodeOfCare<T extends Resource>(): Smart<T>[];
  getBasedOn<T extends Resource>(): Smart<T>[];
  getParticipants<T extends Practitioner | PractitionerRole | RelatedPerson | Device>(): Smart<T>[];
  getAppointment<T extends Resource>(): Smart<T>[];
  getReasonReference<T extends Resource>(): Smart<T>[];
  getAccount<T extends Resource>(): Smart<T>[];
  getServiceProvider(): Smart<Organization> | undefined;
  getPartOf(): Smart<Encounter> | undefined;
  getHospitalizationOrigin<T extends Location | Organization>(): Smart<T> | undefined;
  getHospitalizationDestination<T extends Location | Organization>(): Smart<T> | undefined;
  getLocation(): Smart<Location>[];
  getDiagnosisCondition<T extends Condition | Procedure>(): Smart<T>[];
}

/**
 * Reference methods for DiagnosticReport resources
 */
export interface DiagnosticReportReferenceMethods {
  getBasedOn<T extends Resource>(): Smart<T>[];
  getSubject<T extends Patient | Group | Device | Location>(): Smart<T> | undefined;
  getEncounter(): Smart<Encounter> | undefined;
  getPerformers<T extends Practitioner | PractitionerRole | Organization | CareTeam>(): Smart<T>[];
  getResultsInterpreter<
    T extends Practitioner | PractitionerRole | Organization | CareTeam
  >(): Smart<T>[];
  getSpecimen<T extends Resource>(): Smart<T>[];
  getResults(): Smart<Observation>[];
  getImagingStudy<T extends Resource>(): Smart<T>[];
  getMediaLink<T extends Resource>(): Smart<T>[];
}

/**
 * Reference methods for Patient resources
 */
export interface PatientReferenceMethods {
  getGeneralPractitioners<T extends Practitioner | PractitionerRole | Organization>(): Smart<T>[];
  getManagingOrganization(): Smart<Organization> | undefined;
  getContactOrganization(): Smart<Organization>[];
  getLinkOther<T extends Patient | RelatedPerson>(): Smart<T>[];
}

/**
 * Reference methods for Practitioner resources
 */
export interface PractitionerReferenceMethods {
  getQualificationIssuer(): Smart<Organization>[];
}

/**
 * Reference methods for PractitionerRole resources
 */
export interface PractitionerRoleReferenceMethods {
  getPractitioner(): Smart<Practitioner> | undefined;
  getOrganization(): Smart<Organization> | undefined;
  getLocation(): Smart<Location>[];
  getHealthcareService<T extends Resource>(): Smart<T>[];
  getEndpoint<T extends Resource>(): Smart<T>[];
}

/**
 * Reference methods for AllergyIntolerance resources
 */
export interface AllergyIntoleranceReferenceMethods {
  getPatient(): Smart<Patient> | undefined;
  getEncounter(): Smart<Encounter> | undefined;
  getRecorder<T extends Practitioner | PractitionerRole | Patient | RelatedPerson>():
    | Smart<T>
    | undefined;
  getAsserter<T extends Patient | RelatedPerson | Practitioner | PractitionerRole>():
    | Smart<T>
    | undefined;
}

/**
 * Reference methods for Condition resources
 */
export interface ConditionReferenceMethods {
  getSubject<T extends Patient | Group>(): Smart<T> | undefined;
  getEncounter(): Smart<Encounter> | undefined;
  getRecorder<T extends Practitioner | PractitionerRole | Patient | RelatedPerson>():
    | Smart<T>
    | undefined;
  getAsserter<T extends Practitioner | PractitionerRole | Patient | RelatedPerson>():
    | Smart<T>
    | undefined;
  getStageAssessment<T extends Resource>(): Smart<T>[];
  getEvidenceDetail<T extends Resource>(): Smart<T>[];
}

/**
 * Reference methods for Organization resources
 */
export interface OrganizationReferenceMethods {
  getPartOf(): Smart<Organization> | undefined;
  getEndpoint<T extends Resource>(): Smart<T>[];
}

/**
 * Reference methods for Location resources
 */
export interface LocationReferenceMethods {
  getManagingOrganization(): Smart<Organization> | undefined;
  getPartOf(): Smart<Location> | undefined;
  getEndpoint<T extends Resource>(): Smart<T>[];
}

/**
 * Reference methods for Composition resources
 */
export interface CompositionReferenceMethods {
  getSubject<T extends Resource>(): Smart<T> | undefined;
  getEncounter(): Smart<Encounter> | undefined;
  getAuthors<
    T extends Practitioner | PractitionerRole | Device | Patient | RelatedPerson | Organization
  >(): Smart<T>[];
  getCustodian(): Smart<Organization> | undefined;
  getAttesterParty<
    T extends Patient | RelatedPerson | Practitioner | PractitionerRole | Organization
  >(): Smart<T>[];
  getRelatesToTarget(): Smart<Composition>[];
  getEventDetail<T extends Resource>(): Smart<T>[];
  getSectionAuthor<
    T extends Practitioner | PractitionerRole | Device | Patient | RelatedPerson | Organization
  >(): Smart<T>[];
  getSectionFocus<T extends Resource>(): Smart<T>[];
  getSectionEntry<T extends Resource>(): Smart<T>[];
}

/**
 * Reference methods for Coverage resources
 */
export interface CoverageReferenceMethods {
  getBeneficiary(): Smart<Patient> | undefined;
  getSubscriber<T extends Patient | RelatedPerson>(): Smart<T> | undefined;
  getPayors<T extends Organization | Patient | RelatedPerson>(): Smart<T>[];
  getPolicyHolder<T extends Patient | RelatedPerson | Organization>(): Smart<T> | undefined;
}

/**
 * Reference methods for DocumentReference resources
 */
export interface DocumentReferenceReferenceMethods {
  getSubject<T extends Patient | Group | Practitioner | PractitionerRole | Device>():
    | Smart<T>
    | undefined;
  getAuthors<
    T extends Practitioner | PractitionerRole | Organization | Device | Patient | RelatedPerson
  >(): Smart<T>[];
  getAuthenticator<T extends Practitioner | PractitionerRole | Organization>():
    | Smart<T>
    | undefined;
  getCustodian(): Smart<Organization> | undefined;
  getRelatesToTarget(): Smart<DocumentReference>[];
  getContextEncounter<T extends Encounter | Resource>(): Smart<T>[];
  getContextSourcePatientInfo(): Smart<Patient> | undefined;
  getContextRelated<T extends Resource>(): Smart<T>[];
}

/**
 * Reference methods for Immunization resources
 */
export interface ImmunizationReferenceMethods {
  getPatient(): Smart<Patient> | undefined;
  getEncounter(): Smart<Encounter> | undefined;
  getLocation(): Smart<Location> | undefined;
  getManufacturer(): Smart<Organization> | undefined;
  getPerformers<T extends Practitioner | PractitionerRole | Organization>(): Smart<T>[];
  getReasonReference<T extends Condition | Observation | DiagnosticReport>(): Smart<T>[];
  getProtocolAppliedAuthority(): Smart<Organization>[];
  getReactionDetail(): Smart<Observation>[];
}

/**
 * Reference methods for Medication resources
 */
export interface MedicationReferenceMethods {
  getManufacturer(): Smart<Organization> | undefined;
  getIngredientItem<T extends Resource | Medication>(): Smart<T>[];
}

/**
 * Reference methods for MedicationRequest resources
 */
export interface MedicationRequestReferenceMethods {
  getReportedReference<
    T extends Patient | Practitioner | PractitionerRole | RelatedPerson | Organization
  >(): Smart<T> | undefined;
  getMedicationReference(): Smart<Medication> | undefined;
  getSubject<T extends Patient | Group>(): Smart<T> | undefined;
  getEncounter(): Smart<Encounter> | undefined;
  getSupportingInformation<T extends Resource>(): Smart<T>[];
  getRequester<
    T extends Practitioner | PractitionerRole | Organization | Patient | RelatedPerson | Device
  >(): Smart<T> | undefined;
  getPerformer<
    T extends
      | Practitioner
      | PractitionerRole
      | Organization
      | Patient
      | Device
      | RelatedPerson
      | CareTeam
  >(): Smart<T> | undefined;
  getRecorder<T extends Practitioner | PractitionerRole>(): Smart<T> | undefined;
  getReasonReference<T extends Condition | Observation>(): Smart<T>[];
  getBasedOn<T extends Resource>(): Smart<T>[];
  getInsurance<T extends Resource>(): Smart<T>[];
  getPriorPrescription(): Smart<MedicationRequest> | undefined;
  getDetectedIssue<T extends Resource>(): Smart<T>[];
  getEventHistory<T extends Resource>(): Smart<T>[];
  getDispenseRequestPerformer(): Smart<Organization> | undefined;
}

/**
 * Reference methods for Procedure resources
 */
export interface ProcedureReferenceMethods {
  getBasedOn<T extends Resource>(): Smart<T>[];
  getPartOf<T extends Procedure | Observation | Resource>(): Smart<T>[];
  getSubject<T extends Patient | Group>(): Smart<T> | undefined;
  getEncounter(): Smart<Encounter> | undefined;
  getRecorder<T extends Patient | RelatedPerson | Practitioner | PractitionerRole>():
    | Smart<T>
    | undefined;
  getAsserter<T extends Patient | RelatedPerson | Practitioner | PractitionerRole>():
    | Smart<T>
    | undefined;
  getPerformers<
    T extends Practitioner | PractitionerRole | Organization | Patient | RelatedPerson | Device
  >(): Smart<T>[];
  getPerformerOnBehalfOf(): Smart<Organization>[];
  getLocation(): Smart<Location> | undefined;
  getReasonReference<
    T extends Condition | Observation | Procedure | DiagnosticReport | DocumentReference
  >(): Smart<T>[];
  getReport<T extends DiagnosticReport | DocumentReference | Composition>(): Smart<T>[];
  getComplicationDetail(): Smart<Condition>[];
  getFocalDeviceManipulated(): Smart<Device>[];
  getUsedReference<T extends Device | Medication | Resource>(): Smart<T>[];
}

/**
 * Reference methods for FamilyMemberHistory resources
 */
export interface FamilyMemberHistoryReferenceMethods {
  getPatient(): Smart<Patient> | undefined;
}

/**
 * Reference methods for MedicationAdministration resources
 */
export interface MedicationAdministrationReferenceMethods {
  getSubject<T extends Patient | Group>(): Smart<T> | undefined;
  getContext<T extends Encounter>(): Smart<T> | undefined;
  getPerformers<
    T extends Practitioner | PractitionerRole | Patient | RelatedPerson | Device
  >(): Smart<T>[];
  getMedicationReference(): Smart<Medication> | undefined;
}

/**
 * Reference methods for MedicationDispense resources
 */
export interface MedicationDispenseReferenceMethods {
  getSubject<T extends Patient | Group>(): Smart<T> | undefined;
  getContext<T extends Encounter>(): Smart<T> | undefined;
  getPerformers<
    T extends Practitioner | PractitionerRole | Organization | Patient | Device | RelatedPerson
  >(): Smart<T>[];
  getMedicationReference(): Smart<Medication> | undefined;
}

/**
 * Reference methods for MedicationStatement resources
 */
export interface MedicationStatementReferenceMethods {
  getSubject<T extends Patient | Group>(): Smart<T> | undefined;
  getContext<T extends Encounter>(): Smart<T> | undefined;
  getInformationSource<
    T extends Patient | Practitioner | PractitionerRole | RelatedPerson | Organization
  >(): Smart<T> | undefined;
  getMedicationReference(): Smart<Medication> | undefined;
}

/**
 * Reference methods for RelatedPerson resources
 */
export interface RelatedPersonReferenceMethods {
  getPatient(): Smart<Patient> | undefined;
}

/**
 * Reference methods for RiskAssessment resources
 */
export interface RiskAssessmentReferenceMethods {
  getSubject<T extends Patient | Group>(): Smart<T> | undefined;
  getEncounter(): Smart<Encounter> | undefined;
  getPerformer<T extends Practitioner | PractitionerRole | Device>(): Smart<T> | undefined;
}

/**
 * Reference methods for ServiceRequest resources
 */
export interface ServiceRequestReferenceMethods {
  getSubject<T extends Patient | Group | Location | Device>(): Smart<T> | undefined;
  getEncounter(): Smart<Encounter> | undefined;
  getRequester<
    T extends Practitioner | PractitionerRole | Organization | Patient | RelatedPerson | Device
  >(): Smart<T> | undefined;
  getPerformers<
    T extends
      | Practitioner
      | PractitionerRole
      | Organization
      | CareTeam
      | Patient
      | Device
      | RelatedPerson
  >(): Smart<T>[];
}

/**
 * Reference methods for CarePlan resources
 */
export interface CarePlanReferenceMethods {
  getBasedOn(): Smart<CarePlan>[];
  getReplaces(): Smart<CarePlan>[];
  getPartOf(): Smart<CarePlan>[];
  getSubject<T extends Patient | Group>(): Smart<T> | undefined;
  getEncounter(): Smart<Encounter> | undefined;
  getAuthor<
    T extends
      | Patient
      | Practitioner
      | PractitionerRole
      | Device
      | RelatedPerson
      | Organization
      | CareTeam
  >(): Smart<T> | undefined;
  getContributor<
    T extends
      | Patient
      | Practitioner
      | PractitionerRole
      | Device
      | RelatedPerson
      | Organization
      | CareTeam
  >(): Smart<T>[];
  getCareTeam(): Smart<CareTeam>[];
  getAddresses(): Smart<Condition>[];
  getSupportingInfo<T extends Resource>(): Smart<T>[];
  getGoal(): Smart<Goal>[];
  getActivityReference<
    T extends
      | Appointment
      | CommunicationRequest
      | DeviceRequest
      | MedicationRequest
      | NutritionOrder
      | Task
      | ServiceRequest
      | VisionPrescription
      | RequestGroup
  >(): Smart<T>[];
  getActivityOutcomeReference<T extends Resource>(): Smart<T>[];
  getActivityDetailReasonReference<
    T extends Condition | Observation | DiagnosticReport | DocumentReference
  >(): Smart<T>[];
  getActivityDetailGoal(): Smart<Goal>[];
  getActivityDetailLocation(): Smart<Location>[];
  getActivityDetailPerformer<
    T extends
      | Practitioner
      | PractitionerRole
      | Organization
      | RelatedPerson
      | Patient
      | CareTeam
      | HealthcareService
      | Device
  >(): Smart<T>[];
  getActivityDetailProductReference<T extends Medication | Substance>(): Smart<T>[];
}

/**
 * Base reference methods for resources that don't have specific reference patterns
 */
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface BaseReferenceMethods {
  // Empty for now, could add common methods if needed
}

/**
 * Conditional type that maps resource types to their reference methods
 */
export type ReferenceMethodsFor<T extends Resource> = T extends Observation
  ? ObservationReferenceMethods
  : T extends Encounter
  ? EncounterReferenceMethods
  : T extends DiagnosticReport
  ? DiagnosticReportReferenceMethods
  : T extends Patient
  ? PatientReferenceMethods
  : T extends Practitioner
  ? PractitionerReferenceMethods
  : T extends PractitionerRole
  ? PractitionerRoleReferenceMethods
  : T extends AllergyIntolerance
  ? AllergyIntoleranceReferenceMethods
  : T extends Condition
  ? ConditionReferenceMethods
  : T extends Organization
  ? OrganizationReferenceMethods
  : T extends Location
  ? LocationReferenceMethods
  : T extends Composition
  ? CompositionReferenceMethods
  : T extends Coverage
  ? CoverageReferenceMethods
  : T extends DocumentReference
  ? DocumentReferenceReferenceMethods
  : T extends Immunization
  ? ImmunizationReferenceMethods
  : T extends Medication
  ? MedicationReferenceMethods
  : T extends MedicationRequest
  ? MedicationRequestReferenceMethods
  : T extends Procedure
  ? ProcedureReferenceMethods
  : T extends FamilyMemberHistory
  ? FamilyMemberHistoryReferenceMethods
  : T extends MedicationAdministration
  ? MedicationAdministrationReferenceMethods
  : T extends MedicationDispense
  ? MedicationDispenseReferenceMethods
  : T extends MedicationStatement
  ? MedicationStatementReferenceMethods
  : T extends RelatedPerson
  ? RelatedPersonReferenceMethods
  : T extends RiskAssessment
  ? RiskAssessmentReferenceMethods
  : T extends ServiceRequest
  ? ServiceRequestReferenceMethods
  : T extends CarePlan
  ? CarePlanReferenceMethods
  : BaseReferenceMethods;

/**
 * Note: We only use the generic Smart<T> pattern for consistency.
 * Specific type aliases like SmartObservation are not needed since
 * Smart<Observation> provides the same functionality.
 */

/**
 * Reference field mapping - maps reference method names to their field paths
 */
export const REFERENCE_METHOD_MAPPING: Record<string, Record<string, string>> = {
  Observation: {
    getBasedOn: "basedOn",
    getPartOf: "partOf",
    getSubject: "subject",
    getFocus: "focus",
    getEncounter: "encounter",
    getPerformers: "performer",
    getSpecimen: "specimen",
    getDevice: "device",
    getHasMember: "hasMember",
    getDerivedFrom: "derivedFrom",
  },
  Encounter: {
    getSubject: "subject",
    getEpisodeOfCare: "episodeOfCare",
    getBasedOn: "basedOn",
    getParticipants: "participant.individual",
    getAppointment: "appointment",
    getReasonReference: "reasonReference",
    getAccount: "account",
    getServiceProvider: "serviceProvider",
    getPartOf: "partOf",
    getHospitalizationOrigin: "hospitalization.origin",
    getHospitalizationDestination: "hospitalization.destination",
    getLocation: "location.location",
    getDiagnosisCondition: "diagnosis.condition",
  },
  DiagnosticReport: {
    getBasedOn: "basedOn",
    getSubject: "subject",
    getEncounter: "encounter",
    getPerformers: "performer",
    getResultsInterpreter: "resultsInterpreter",
    getSpecimen: "specimen",
    getResults: "result",
    getImagingStudy: "imagingStudy",
    getMediaLink: "media.link",
  },
  Patient: {
    getGeneralPractitioners: "generalPractitioner",
    getManagingOrganization: "managingOrganization",
    getContactOrganization: "contact.organization",
    getLinkOther: "link.other",
  },
  Practitioner: {
    getQualificationIssuer: "qualification.issuer",
  },
  PractitionerRole: {
    getPractitioner: "practitioner",
    getOrganization: "organization",
    getLocation: "location",
    getHealthcareService: "healthcareService",
    getEndpoint: "endpoint",
  },
  AllergyIntolerance: {
    getPatient: "patient",
    getEncounter: "encounter",
    getRecorder: "recorder",
    getAsserter: "asserter",
  },
  Condition: {
    getSubject: "subject",
    getEncounter: "encounter",
    getRecorder: "recorder",
    getAsserter: "asserter",
    getStageAssessment: "stage.assessment",
    getEvidenceDetail: "evidence.detail",
  },
  Organization: {
    getPartOf: "partOf",
    getEndpoint: "endpoint",
  },
  Location: {
    getManagingOrganization: "managingOrganization",
    getPartOf: "partOf",
    getEndpoint: "endpoint",
  },
  Composition: {
    getSubject: "subject",
    getEncounter: "encounter",
    getAuthors: "author",
    getCustodian: "custodian",
    getAttesterParty: "attester.party",
    getRelatesToTarget: "relatesTo.targetReference",
    getEventDetail: "event.detail",
    getSectionAuthor: "section.author",
    getSectionFocus: "section.focus",
    getSectionEntry: "section.entry",
  },
  Coverage: {
    getBeneficiary: "beneficiary",
    getSubscriber: "subscriber",
    getPayors: "payor",
    getPolicyHolder: "policyHolder",
  },
  DocumentReference: {
    getSubject: "subject",
    getAuthors: "author",
    getAuthenticator: "authenticator",
    getCustodian: "custodian",
    getRelatesToTarget: "relatesTo.target",
    getContextEncounter: "context.encounter",
    getContextSourcePatientInfo: "context.sourcePatientInfo",
    getContextRelated: "context.related",
  },
  Immunization: {
    getPatient: "patient",
    getEncounter: "encounter",
    getLocation: "location",
    getManufacturer: "manufacturer",
    getPerformers: "performer.actor",
    getReasonReference: "reasonReference",
    getProtocolAppliedAuthority: "protocolApplied.authority",
    getReactionDetail: "reaction.detail",
  },
  Medication: {
    getManufacturer: "manufacturer",
    getIngredientItem: "ingredient.itemReference",
  },
  MedicationRequest: {
    getReportedReference: "reportedReference",
    getMedicationReference: "medicationReference",
    getSubject: "subject",
    getEncounter: "encounter",
    getSupportingInformation: "supportingInformation",
    getRequester: "requester",
    getPerformer: "performer",
    getRecorder: "recorder",
    getReasonReference: "reasonReference",
    getBasedOn: "basedOn",
    getInsurance: "insurance",
    getPriorPrescription: "priorPrescription",
    getDetectedIssue: "detectedIssue",
    getEventHistory: "eventHistory",
    getDispenseRequestPerformer: "dispenseRequest.performer",
  },
  Procedure: {
    getBasedOn: "basedOn",
    getPartOf: "partOf",
    getSubject: "subject",
    getEncounter: "encounter",
    getRecorder: "recorder",
    getAsserter: "asserter",
    getPerformers: "performer.actor",
    getPerformerOnBehalfOf: "performer.onBehalfOf",
    getLocation: "location",
    getReasonReference: "reasonReference",
    getReport: "report",
    getComplicationDetail: "complicationDetail",
    getFocalDeviceManipulated: "focalDevice.manipulated",
    getUsedReference: "usedReference",
  },
  FamilyMemberHistory: {
    getPatient: "patient",
  },
  MedicationAdministration: {
    getSubject: "subject",
    getContext: "context",
    getPerformers: "performer.actor",
    getMedicationReference: "medicationReference",
  },
  MedicationDispense: {
    getSubject: "subject",
    getContext: "context",
    getPerformers: "performer.actor",
    getMedicationReference: "medicationReference",
  },
  MedicationStatement: {
    getSubject: "subject",
    getContext: "context",
    getInformationSource: "informationSource",
    getMedicationReference: "medicationReference",
  },
  RelatedPerson: {
    getPatient: "patient",
  },
  RiskAssessment: {
    getSubject: "subject",
    getEncounter: "encounter",
    getPerformer: "performer",
  },
  ServiceRequest: {
    getSubject: "subject",
    getEncounter: "encounter",
    getRequester: "requester",
    getPerformers: "performer",
  },
  CarePlan: {
    getBasedOn: "basedOn",
    getReplaces: "replaces",
    getPartOf: "partOf",
    getSubject: "subject",
    getEncounter: "encounter",
    getAuthor: "author",
    getContributor: "contributor",
    getCareTeam: "careTeam",
    getAddresses: "addresses",
    getSupportingInfo: "supportingInfo",
    getGoal: "goal",
    getActivityReference: "activity.reference",
    getActivityOutcomeReference: "activity.outcomeReference",
    getActivityDetailReasonReference: "activity.detail.reasonReference",
    getActivityDetailGoal: "activity.detail.goal",
    getActivityDetailLocation: "activity.detail.location",
    getActivityDetailPerformer: "activity.detail.performer",
    getActivityDetailProductReference: "activity.detail.productReference",
  },
};

/**
 * Helper type to check if a method name is a valid reference method for a resource type
 */
export function isReferenceMethod(methodName: string, resourceType: string): boolean {
  const mapping = REFERENCE_METHOD_MAPPING[resourceType];
  return mapping ? methodName in mapping : false;
}

/**
 * Get the reference field path for a method name and resource type
 */
export function getReferenceField(methodName: string, resourceType: string): string | undefined {
  const mapping = REFERENCE_METHOD_MAPPING[resourceType];
  return mapping ? mapping[methodName] : undefined;
}
