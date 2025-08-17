import * as stream from "stream";
import { RequestMetadata } from "./commonwell";
import { CertificateParam, CertificateResp } from "../models/certificates";
import { DocumentQueryResponse, DocumentQueryFullResponse } from "../models/document";
import { Identifier, StrongId } from "../models/identifier";
import { NetworkLink, PatientLinkProxy } from "../models/link";
import { Organization, OrganizationList } from "../models/organization";
import {
  Patient,
  PatientNetworkLinkResp,
  PatientSearchResp,
  PatientLinkResp,
} from "../models/patient";
import { PatientLink, PatientLinkSearchResp, Person, PersonSearchResp } from "../models/person";

export interface CommonWellAPI {
  get lastReferenceHeader(): string | undefined;
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
  ): Promise<void>;
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
  enrollPerson(meta: RequestMetadata, person: Person): Promise<Person>;
  searchPerson(meta: RequestMetadata, key: string, system: string): Promise<PersonSearchResp>;
  searchPersonByPatientDemo(meta: RequestMetadata, patientId: string): Promise<PersonSearchResp>;
  getPersonById(meta: RequestMetadata, personId: string): Promise<Person>;
  updatePerson(meta: RequestMetadata, person: Person, id: string): Promise<Person>;
  patientMatch(meta: RequestMetadata, id: string): Promise<PatientSearchResp>;
  addPatientLink(
    meta: RequestMetadata,
    personId: string,
    patientUri: string,
    patientStrongId?: StrongId
  ): Promise<PatientLink>;
  reenrollPerson(meta: RequestMetadata, id: string): Promise<Person>;
  unenrollPerson(meta: RequestMetadata, id: string): Promise<Person>;
  deletePerson(meta: RequestMetadata, id: string): Promise<void>;
  registerPatient(meta: RequestMetadata, patient: Patient): Promise<Patient>;
  getPatient(meta: RequestMetadata, id: string): Promise<Patient>;
  searchPatient(
    meta: RequestMetadata,
    fname: string,
    lname: string,
    dob: string,
    gender?: string,
    zip?: string
  ): Promise<PatientSearchResp>;
  updatePatient(meta: RequestMetadata, patient: Patient, id: string): Promise<Patient>;
  mergePatients(
    meta: RequestMetadata,
    nonSurvivingPatientId: string,
    referencePatientLink: string
  ): Promise<void>;
  getNetworkLinks(meta: RequestMetadata, patientId: string): Promise<PatientNetworkLinkResp>;
  deletePatient(meta: RequestMetadata, id: string): Promise<void>;
  queryDocuments(meta: RequestMetadata, patientId: string): Promise<DocumentQueryResponse>;
  queryDocumentsFull(meta: RequestMetadata, patientId: string): Promise<DocumentQueryFullResponse>;
  retrieveDocument(
    meta: RequestMetadata,
    inputUrl: string,
    outputStream: stream.Writable
  ): Promise<void>;
  upgradeOrDowngradeNetworkLink(
    meta: RequestMetadata,
    href: string,
    proxy?: PatientLinkProxy
  ): Promise<NetworkLink>;
  updatePatientLink(
    meta: RequestMetadata,
    patientLinkUri: string,
    patientUri?: string,
    identifier?: Identifier
  ): Promise<PatientLink>;
  getPatientLinks(
    meta: RequestMetadata,
    personId: string,
    limitToOrg?: boolean
  ): Promise<PatientLinkSearchResp>;
  getPatientLink(
    meta: RequestMetadata,
    personId: string,
    patientId: string
  ): Promise<PatientLinkResp>;
  deletePatientLink(meta: RequestMetadata, patientLinkUri: string): Promise<void>;
  resetPatientLink(meta: RequestMetadata, personId: string, patientId: string): Promise<void>;
}
