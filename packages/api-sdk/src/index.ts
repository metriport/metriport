// Devices API
export { MetriportDevicesApi } from "./devices/client/metriport";
export { Activity } from "./devices/models/activity";
export { Biometrics } from "./devices/models/biometrics";
export { Body } from "./devices/models/body";
export { ConnectedUserInfo } from "./devices/models/common/connected-user-info";
export { Food } from "./devices/models/common/food";
export { ProviderSource } from "./devices/models/common/provider-source";
export { SourceType } from "./devices/models/common/source-type";
export { Nutrition } from "./devices/models/nutrition";
export { Sleep } from "./devices/models/sleep";
export { User } from "./devices/models/user";

// Medical API
export {
  WebhookRequestParsingFailure,
  WebhookRequest,
  WebhookRequestStatus,
  WebhookType,
} from "@metriport/shared/medical";
export type { ResponseMeta, PaginatedResponse } from "@metriport/shared";
export { MetriportMedicalApi } from "./medical/client/metriport";
export { Address, addressSchema, usStateForAddressSchema } from "./medical/models/common/address";
export { BaseUpdate, baseUpdateSchema } from "./medical/models/common/base-update";
export { MedicalDataSource } from "./medical/models/common/medical-data-source";
export {
  USState,
  usStateSchema,
  USTerritory,
  usTerritorySchema,
} from "./medical/models/common/us-data";
export {
  Contact,
  contactSchema,
  Demographics,
  demographicsSchema,
  genderAtBirthSchema,
  PersonalIdentifier,
  personalIdentifierSchema,
  GeneralTypeIdentifier,
  generalPersonalIdentifiers,
  DriverLicenseIdentifier,
  driversLicensePersonalIdentifier,
} from "./medical/models/demographics";
export {
  DocumentQuery,
  documentQuerySchema,
  DocumentQueryStatus,
  documentQueryStatusSchema,
  ListDocumentFilters,
  ListDocumentResult,
  UploadDocumentResult,
} from "./medical/models/document";
export { MedicalRecordsStatusDTO } from "./medical/models/medicalRecordStatus";
export {
  Facility,
  FacilityCreate,
  facilityCreateSchema,
  facilityListSchema,
  facilitySchema,
} from "./medical/models/facility";
export * from "./medical/models/fhir";
export {
  Organization,
  OrganizationCreate,
  organizationCreateSchema,
  organizationSchema,
  OrgType,
  orgTypeSchema,
} from "./medical/models/organization";
export {
  Patient,
  PatientCreate,
  patientCreateSchema,
  patientListSchema,
  patientSchema,
  PatientUpdate,
  patientUpdateSchema,
} from "./medical/models/patient";
export { PatientDTO } from "./medical/models/patientDTO";
