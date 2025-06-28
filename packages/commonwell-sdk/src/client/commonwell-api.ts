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

// TODO ENG-200 Review the remaining methods here
export interface CommonWellAPI {
  get lastTransactionId(): string | undefined;

  createOrUpdatePatient(patient: Patient, options?: BaseOptions): Promise<PatientCollection>;

  getPatient(params: GetPatientParams, options?: BaseOptions): Promise<PatientCollection>;
  getPatient(id: string, options?: BaseOptions): Promise<PatientCollection>;

  // searchPatient(
  //   meta: RequestMetadata,
  //   fname: string,
  //   lname: string,
  //   dob: string,
  //   gender?: string,
  //   zip?: string
  // ): Promise<PatientSearchResp>;
  // updatePatient(meta: RequestMetadata, patient: Patient, id: string): Promise<Patient>;

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

  // getNetworkLinks(meta: RequestMetadata, patientId: string): Promise<PatientNetworkLinkResp>;

  deletePatient(id: string, options?: BaseOptions): Promise<void>;

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

  // upgradeOrDowngradeNetworkLink(
  //   href: string,
  //   proxy?: PatientLinkProxy, options?: BaseOptions
  // ): Promise<NetworkLink>;
  // updatePatientLink(
  //   patientLinkUri: string,
  //   patientUri?: string,
  //   identifier?: Identifier, options?: BaseOptions
  // ): Promise<PatientLink>;

  getPatientLinksByPatientId(
    patientId: string,
    options?: BaseOptions
  ): Promise<PatientLinkSearchResp>;

  // getPatientLink(
  //   personId: string,
  //   patientId: string, options?: BaseOptions
  // ): Promise<PatientLinkResp>;

  // TODO ENG-200 Implement this
  deletePatientLink(patientLinkUri: string, options?: BaseOptions): Promise<void>;

  // TODO ENG-200 Implement this
  resetPatientLink(personId: string, patientId: string, options?: BaseOptions): Promise<void>;
}
