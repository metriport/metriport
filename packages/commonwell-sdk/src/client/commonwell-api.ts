import { PurposeOfUse } from "@metriport/shared";
import * as stream from "stream";
import { DocumentQueryResponse, DocumentStatus } from "../models/document";
import {
  Patient,
  PatientCollection,
  PatientLinkSearchResp,
  PatientMergeResponse,
} from "../models/patient";

export type BaseOptions = {
  meta?: OrganizationRequestMetadata;
};

export type OrganizationRequestMetadata = {
  role: string;
  subjectId: string;
  purposeOfUse: PurposeOfUse;
  payloadHash?: string;
  npi: string;
};

export type GetPatientParams = {
  id: string;
  assignAuthority: string;
  assignAuthorityType?: string | undefined;
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

  getPatient(params: GetPatientParams, options?: BaseOptions): Promise<PatientCollection>;
  getPatient(id: string, options?: BaseOptions): Promise<PatientCollection>;

  // ENG-200: Search patients
  // 10.2.3 Patient Match
  // This allows us to do a patient search that retrieves patient matches.
  // https://www.commonwellalliance.org/wp-content/uploads/2025/06/Services-Specification-v4.3-Approved-2025.06.03-1.pdf

  mergePatients(
    {
      nonSurvivingPatientId,
      survivingPatientId,
    }: {
      nonSurvivingPatientId: string;
      survivingPatientId: string;
    },
    options?: BaseOptions
  ): Promise<PatientMergeResponse>;

  deletePatient(id: string, options?: BaseOptions): Promise<void>;

  getPatientLinksByPatientId(
    patientId: string,
    options?: BaseOptions
  ): Promise<PatientLinkSearchResp>;

  getProbableLinksById(patientId: string, options?: BaseOptions): Promise<PatientLinkSearchResp>;
  getProbableLinksByDemographics(
    params: {
      firstName: string;
      lastName: string;
      dob: string;
      gender: string;
      zip: string;
    },
    options?: BaseOptions
  ): Promise<PatientLinkSearchResp>;

  // TODO ENG-200 Implement this
  // linkPatients(patientId: string, linkId: string, options?: BaseOptions): Promise<void>;

  // TODO ENG-200 Implement this
  // unlinkPatients(patientId: string, linkId: string, options?: BaseOptions): Promise<void>;

  // TODO ENG-200 Choose one
  queryDocuments(
    patientId: string,
    options?: BaseOptions & DocumentQueryParams
  ): Promise<DocumentQueryResponse>;
  // queryDocumentsFull(patientId: string, options?: BaseOptions): Promise<DocumentQueryFullResponse>;

  // TODO ENG-200 Implement this
  retrieveDocument(
    inputUrl: string,
    outputStream: stream.Writable,
    options?: BaseOptions
  ): Promise<void>;
}
