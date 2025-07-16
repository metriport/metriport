import { PurposeOfUse } from "@metriport/shared";
import * as stream from "stream";
import { DocumentQueryFullResponse, DocumentReference, DocumentStatus } from "../models/document";
import {
  Patient,
  PatientCollection,
  PatientCollectionItem,
  StatusResponse,
} from "../models/patient";

export type BaseOptions = {
  meta?: OrganizationRequestMetadata;
};

export type OrganizationRequestMetadata = {
  role: string;
  subjectId: string;
  purposeOfUse: PurposeOfUse;
  npi: string;
  /**
   * Required for Delegation of Authority (DOA) requests.
   *
   * When sending delegated requests, the delegate organization must include information about the
   * principal organization.
   *
   * The value MUST be the Directory Entry assigned to the Principal for whom the Delegate is
   * initiating the request, formatted using the FHIR (Fast Healthcare Interoperability Resources)
   * Resource (Reference?) format.
   *
   * Example: "Organization/urn:oid:2.16.840.1.113883.3.7204.1"
   *
   * @see https://www.commonwellalliance.org/specification/
   */
  authGrantorReference?: string;
};

export type GetPatientParams = {
  id: string;
  assignAuthority: string;
  assignAuthorityType?: string | undefined;
};

export type RetrieveDocumentResponse = {
  contentType: string;
  size: number;
};

export interface DocumentQueryParams {
  /** ID of who/what is the subject of the document */
  subjectId?: string;
  /** Author information for the document */
  author?: {
    /** Given name of who and/or what authored the document */
    given?: string;
    /** Family name of who and/or what authored the document */
    family?: string;
  };
  /** Status of the document reference */
  status?: DocumentStatus;
  /** Time of service period being documented */
  period?: {
    /** Time of service start that is being documented. Comparators: ge */
    start?: string;
    /** Time of service end that is being documented. Comparators: le */
    end?: string;
  };
  /** When the document reference was created */
  date?: {
    /** When the document reference was created. Comparators: ge */
    start?: string;
    /** When the document reference was created. Comparators: le */
    end?: string;
  };
}

export interface CommonWellAPI {
  get lastTransactionId(): string | undefined;

  createOrUpdatePatient(patient: Patient, options?: BaseOptions): Promise<PatientCollection>;

  getPatient(
    params: GetPatientParams,
    options?: BaseOptions
  ): Promise<PatientCollectionItem | undefined>;
  getPatient(id: string, options?: BaseOptions): Promise<PatientCollectionItem | undefined>;

  // ENG-200: Search patients
  // 10.2.3 Patient Match
  // This allows us to do a patient search that retrieves patient matches.
  // https://www.commonwellalliance.org/specification/

  mergePatients(
    {
      nonSurvivingPatientId,
      survivingPatientId,
    }: {
      nonSurvivingPatientId: string;
      survivingPatientId: string;
    },
    options?: BaseOptions
  ): Promise<StatusResponse>;

  deletePatient(id: string, options?: BaseOptions): Promise<void>;

  getPatientLinksByPatientId(patientId: string, options?: BaseOptions): Promise<PatientCollection>;

  getProbableLinksById(patientId: string, options?: BaseOptions): Promise<PatientCollection>;
  getProbableLinksByDemographics(
    params: {
      firstName: string;
      lastName: string;
      dob: string;
      gender: string;
      zip: string;
    },
    options?: BaseOptions
  ): Promise<PatientCollection>;

  linkPatients(urlToLinkPatients: string, options?: BaseOptions): Promise<StatusResponse>;
  unlinkPatients(urlToUnlinkPatients: string, options?: BaseOptions): Promise<StatusResponse>;
  resetPatientLinks(urlToResetPatientLinks: string, options?: BaseOptions): Promise<StatusResponse>;

  queryDocuments(
    patientId: string,
    options?: BaseOptions & DocumentQueryParams
  ): Promise<DocumentReference[]>;
  queryDocumentsFull(patientId: string, options?: BaseOptions): Promise<DocumentQueryFullResponse>;

  retrieveDocument(
    inputUrl: string,
    outputStream: stream.Writable,
    options?: BaseOptions
  ): Promise<RetrieveDocumentResponse>;
}
