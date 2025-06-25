/* eslint-disable @typescript-eslint/no-unused-vars */
import * as sdk from "@metriport/commonwell-sdk";
import * as nanoid from "nanoid";
import * as stream from "stream";
import NotImplementedError from "../../errors/not-implemented";
import { uuidv7 } from "@metriport/core/util/uuid-v7";
import {
  createDocument,
  createPatient,
  createPatientLink,
  createPatientWithLinks,
  createPerson,
} from "./sandbox-payloads";

const cwURL = "https://sandbox.rest.api.commonwellalliance.org";
const idAlphabet = "123456789";
export const primaryPatientId = nanoid.customAlphabet(idAlphabet, 6)();

function makePatientId() {
  return uuidv7();
}

export class CommonWellMock implements sdk.CommonWellAPI {
  // V1
  static PERSON_ENDPOINT = "/v1/person";
  static ORG_ENDPOINT = "/v1/org";
  static PATIENT_ENDPOINT = "/v1/patient";
  static MEMBER_ENDPOINT = "/v1/member";
  // V2
  static DOCUMENT_QUERY_ENDPOINT = "/v2/documentReference";

  private orgName: string;
  private _oid: string;

  constructor(orgName: string, oid: string) {
    this.orgName = orgName;
    this._oid = oid;
  }

  get oid() {
    return this._oid;
  }
  get lastReferenceHeader() {
    return undefined;
  }

  //--------------------------------------------------------------------------------------------
  // Org Management
  //--------------------------------------------------------------------------------------------

  async createOrg(
    meta: sdk.RequestMetadata,
    organization: sdk.Organization
  ): Promise<sdk.Organization> {
    return organization;
  }

  async updateOrg(
    meta: sdk.RequestMetadata,
    organization: sdk.Organization
  ): Promise<sdk.Organization> {
    return organization;
  }

  // NOT USED YET
  async getAllOrgs(
    meta: sdk.RequestMetadata,
    summary?: boolean,
    offset?: number,
    limit?: number,
    sort?: string
  ): Promise<sdk.OrganizationList> {
    throw new NotImplementedError();
  }

  // NOT USED YET
  async getOneOrg(meta: sdk.RequestMetadata, id: string): Promise<sdk.Organization | undefined> {
    throw new NotImplementedError();
  }

  // USED BUT DOESNT RETURN ANYTHING YET
  async addCertificateToOrg(
    meta: sdk.RequestMetadata,
    certificate: sdk.CertificateParam,
    id: string
  ): Promise<sdk.CertificateResp> {
    return {
      certificates: [{ purpose: sdk.CertificatePurpose.Signing }],
      _links: {
        self: null,
      },
    };
  }

  // NOT USED YET
  async replaceCertificateForOrg(
    meta: sdk.RequestMetadata,
    certificate: sdk.CertificateParam,
    id: string
  ): Promise<sdk.CertificateResp> {
    throw new NotImplementedError();
  }

  // NOT USED YET
  async deleteCertificateFromOrg() {
    return;
  }

  // NOT USED YET
  async getCertificatesFromOrg(
    meta: sdk.RequestMetadata,
    id: string,
    thumbprint?: string,
    purpose?: string
  ): Promise<sdk.CertificateResp> {
    throw new NotImplementedError();
  }

  // NOT USED YET
  async getCertificatesFromOrgByThumbprint(
    meta: sdk.RequestMetadata,
    id: string,
    thumbprint: string,
    purpose?: string
  ): Promise<sdk.CertificateResp> {
    throw new NotImplementedError();
  }

  // NOT USED YET
  async getCertificatesFromOrgByThumbprintAndPurpose(
    meta: sdk.RequestMetadata,
    id: string,
    thumbprint: string,
    purpose: string
  ): Promise<sdk.CertificateResp> {
    throw new NotImplementedError();
  }

  //--------------------------------------------------------------------------------------------
  // Person Management
  //--------------------------------------------------------------------------------------------

  async enrollPerson(meta: sdk.RequestMetadata, person: sdk.Person): Promise<sdk.Person> {
    return person;
  }

  async searchPerson(
    meta: sdk.RequestMetadata,
    key: string,
    system: string
  ): Promise<sdk.PersonSearchResp> {
    const mockPersonId = nanoid.customAlphabet(idAlphabet, 6)();

    const person = createPerson(this._oid, this.orgName, mockPersonId);

    return {
      message: "CommonWell found 1 Person matching your search criteria.",
      _links: {
        self: {
          href: `${cwURL}${CommonWellMock.PERSON_ENDPOINT}?key=${key}&system=urn%3Aoid%3A${system}`,
        },
      },
      _embedded: {
        person: [
          {
            ...person,
            details: {
              ...person.details,
              identifier: [
                {
                  use: "usual",
                  system: system,
                  key: key,
                },
              ],
            },
          },
        ],
      },
    };
  }

  async searchPersonByPatientDemo(
    meta: sdk.RequestMetadata,
    patientId: string
  ): Promise<sdk.PersonSearchResp> {
    const mockPersonId = nanoid.customAlphabet(idAlphabet, 6)();

    const person = createPerson(this._oid, this.orgName, mockPersonId);

    return {
      message: "CommonWell found 1 Person matching your search criteria.",
      _links: {
        self: {
          href: `${cwURL}${CommonWellMock.ORG_ENDPOINT}/${this.oid}/patient/${patientId}/person`,
        },
      },
      _embedded: {
        person: [person],
      },
    };
  }

  async getPersonById(meta: sdk.RequestMetadata, personId: string): Promise<sdk.Person> {
    const person = createPerson(this._oid, this.orgName, personId);

    return person;
  }

  async updatePerson(meta: sdk.RequestMetadata, person: sdk.Person): Promise<sdk.Person> {
    return person;
  }

  // NOT USED YET
  async patientMatch(meta: sdk.RequestMetadata, id: string): Promise<sdk.PatientSearchResp> {
    throw new NotImplementedError();
  }

  async addPatientLink(
    meta: sdk.RequestMetadata,
    personId: string,
    patientUri: string
  ): Promise<sdk.PatientLink> {
    return {
      patient: patientUri,
      assuranceLevel: "2",
      _links: {
        self: {
          href: `${cwURL}${CommonWellMock.PERSON_ENDPOINT}/${personId}/patientLink/${primaryPatientId}`,
        },
      },
    };
  }

  async reenrollPerson(meta: sdk.RequestMetadata, id: string): Promise<sdk.Person> {
    const person = createPerson(this._oid, this.orgName, id);
    return person;
  }

  // NOT USED YET
  async unenrollPerson(meta: sdk.RequestMetadata, id: string): Promise<sdk.Person> {
    throw new NotImplementedError();
  }

  // NOT USED YET
  async deletePerson() {
    return;
  }

  //--------------------------------------------------------------------------------------------
  // Patient Management
  //--------------------------------------------------------------------------------------------

  async registerPatient(meta: sdk.RequestMetadata, patient: sdk.Patient): Promise<sdk.Patient> {
    const patientWithLinks = createPatientWithLinks(patient);
    return patientWithLinks;
  }

  async getPatient(meta: sdk.RequestMetadata, id: string): Promise<sdk.Patient> {
    const patient = createPatient(this.oid, this.orgName, id);

    return patient;
  }

  // NOT USED YET
  async searchPatient(
    meta: sdk.RequestMetadata,
    fname: string,
    lname: string,
    dob: string,
    gender?: string,
    zip?: string
  ): Promise<sdk.PatientSearchResp> {
    throw new NotImplementedError();
  }

  async updatePatient(meta: sdk.RequestMetadata, patient: sdk.Patient): Promise<sdk.Patient> {
    const patientWithLinks = createPatientWithLinks(patient);
    return patientWithLinks;
  }

  // NOT USED YET
  async mergePatients() {
    return;
  }

  async getNetworkLinks(
    meta: sdk.RequestMetadata,
    patientId: string
  ): Promise<sdk.PatientNetworkLinkResp> {
    const patient = createPatient(this.oid, this.orgName, patientId);

    return {
      _embedded: {
        networkLink: [
          {
            _links: {},
            assuranceLevel: "2",
            patient: patient,
          },
        ],
      },
      _links: createPatientWithLinks(patient)._links,
    };
  }

  // NOT USED YET
  async deletePatient() {
    return;
  }

  //--------------------------------------------------------------------------------------------
  // Document Management
  //--------------------------------------------------------------------------------------------

  async queryDocuments(): Promise<sdk.DocumentQueryResponse> {
    const document = createDocument(this.oid, this.orgName);

    return document;
  }
  async queryDocumentsFull(): Promise<sdk.DocumentQueryFullResponse> {
    const document = createDocument(this.oid, this.orgName);

    return document;
  }

  async retrieveDocument(
    meta: sdk.RequestMetadata,
    inputUrl: string,
    outputStream: stream.Writable
  ): Promise<void> {
    await sdk.downloadFile({
      url: inputUrl,
      outputStream,
    });

    return;
  }

  //--------------------------------------------------------------------------------------------
  // Link Management
  //--------------------------------------------------------------------------------------------

  // USED BUT DOESNT RETURN ANYTHING
  async upgradeOrDowngradeNetworkLink(
    meta: sdk.RequestMetadata,
    href: string,
    proxy?: sdk.PatientLinkProxy
  ): Promise<sdk.NetworkLink> {
    return {
      _links: {},
      assuranceLevel: "2",
      patient: createPatient(this.oid, this.orgName, makePatientId()),
    };
  }

  // NOT USED YET
  async updatePatientLink(
    meta: sdk.RequestMetadata,
    patientLinkUri: string,
    patientUri?: string,
    identifier?: sdk.Identifier
  ): Promise<sdk.PatientLink> {
    throw new NotImplementedError();
  }

  async getPatientLinks(
    meta: sdk.RequestMetadata,
    personId: string
  ): Promise<sdk.PatientLinkSearchResp> {
    const patientLinkUrl = `${cwURL}${CommonWellMock.PERSON_ENDPOINT}/${personId}/patientLink`;
    const patientLink = createPatientLink(patientLinkUrl, primaryPatientId, this.oid);

    return patientLink;
  }

  async getPatientLink(
    meta: sdk.RequestMetadata,
    personId: string,
    patientId: string
  ): Promise<sdk.PatientLinkResp> {
    const patientLinkUrl = `${cwURL}${CommonWellMock.PERSON_ENDPOINT}/${personId}/patientLink`;
    const patientLink = createPatientLink(patientLinkUrl, patientId, this.oid);

    return patientLink;
  }

  // NOT USED YET
  async deletePatientLink() {
    return;
  }

  async resetPatientLink(): Promise<void> {
    return;
  }
}
