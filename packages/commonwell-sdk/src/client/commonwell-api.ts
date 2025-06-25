import * as stream from "stream";
import { CertificateParam, CertificateResp } from "../models/certificates";
import { DocumentQueryFullResponse, DocumentQueryResponse } from "../models/document";
import { Organization, OrganizationList } from "../models/organization";
import {
  Patient,
  PatientCollection,
  PatientLinkSearchResp,
  PatientMergeResponse,
} from "../models/patient";
import { RequestMetadata } from "./commonwell";

export type GetPatientParams = {
  meta: RequestMetadata;
  id: string;
  assignAuthority: string;
  assignAuthorityType?: string | undefined;
};

// TODO ENG-200 Review the remaining methods here
export interface CommonWellAPI {
  get lastTransactionId(): string | undefined;
  createOrg(meta: RequestMetadata, organization: Organization): Promise<Organization>;
  updateOrg(meta: RequestMetadata, organization: Organization, id: string): Promise<Organization>;
  getAllOrgs(
    meta: RequestMetadata,
    summary?: boolean,
    offset?: number,
    limit?: number,
    sort?: string
  ): Promise<OrganizationList>;
  getOneOrg(meta: RequestMetadata, id: string): Promise<Organization | undefined>;
  addCertificateToOrg(
    meta: RequestMetadata,
    certificate: CertificateParam,
    id: string
  ): Promise<CertificateResp>;
  replaceCertificateForOrg(
    meta: RequestMetadata,
    certificate: CertificateParam,
    id: string
  ): Promise<CertificateResp>;
  deleteCertificateFromOrg(
    meta: RequestMetadata,
    id: string,
    thumbprint: string,
    purpose: string
  ): Promise<string>;
  getCertificatesFromOrg(
    meta: RequestMetadata,
    id: string,
    thumbprint?: string,
    purpose?: string
  ): Promise<CertificateResp>;
  getCertificatesFromOrgByThumbprint(
    meta: RequestMetadata,
    id: string,
    thumbprint: string,
    purpose?: string
  ): Promise<CertificateResp>;
  getCertificatesFromOrgByThumbprintAndPurpose(
    meta: RequestMetadata,
    id: string,
    thumbprint: string,
    purpose: string
  ): Promise<CertificateResp>;
  createOrUpdatePatient(meta: RequestMetadata, patient: Patient): Promise<PatientCollection>;

  getPatient(params: GetPatientParams): Promise<PatientCollection>;
  getPatient(meta: RequestMetadata, id: string): Promise<PatientCollection>;

  // searchPatient(
  //   meta: RequestMetadata,
  //   fname: string,
  //   lname: string,
  //   dob: string,
  //   gender?: string,
  //   zip?: string
  // ): Promise<PatientSearchResp>;
  // updatePatient(meta: RequestMetadata, patient: Patient, id: string): Promise<Patient>;
  mergePatients({
    meta,
    nonSurvivingPatientId,
    survivingPatientId,
  }: {
    meta: RequestMetadata;
    nonSurvivingPatientId: string;
    survivingPatientId: string;
  }): Promise<PatientMergeResponse>;
  // getNetworkLinks(meta: RequestMetadata, patientId: string): Promise<PatientNetworkLinkResp>;
  deletePatient(meta: RequestMetadata, id: string): Promise<void>;
  queryDocuments(meta: RequestMetadata, patientId: string): Promise<DocumentQueryResponse>;
  queryDocumentsFull(meta: RequestMetadata, patientId: string): Promise<DocumentQueryFullResponse>;
  retrieveDocument(
    meta: RequestMetadata,
    inputUrl: string,
    outputStream: stream.Writable
  ): Promise<void>;
  // upgradeOrDowngradeNetworkLink(
  //   meta: RequestMetadata,
  //   href: string,
  //   proxy?: PatientLinkProxy
  // ): Promise<NetworkLink>;
  // updatePatientLink(
  //   meta: RequestMetadata,
  //   patientLinkUri: string,
  //   patientUri?: string,
  //   identifier?: Identifier
  // ): Promise<PatientLink>;
  getPatientLinksByPatientId(
    meta: RequestMetadata,
    patientId: string
    // limitToOrg?: boolean
  ): Promise<PatientLinkSearchResp>;
  // getPatientLink(
  //   meta: RequestMetadata,
  //   personId: string,
  //   patientId: string
  // ): Promise<PatientLinkResp>;
  deletePatientLink(meta: RequestMetadata, patientLinkUri: string): Promise<void>;
  resetPatientLink(meta: RequestMetadata, personId: string, patientId: string): Promise<void>;
}
