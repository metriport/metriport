import {
  CommonWellAPI,
  RequestMetadata,
  Organization,
  Person,
  Patient,
} from "@metriport/commonwell-sdk";
import { downloadFile } from "@metriport/commonwell-sdk/lib/common/fileDownload";
import { PersonSearchResp } from "@metriport/commonwell-sdk/lib/models/person";
import { PatientLink, PatientLinkSearchResp } from "@metriport/commonwell-sdk/lib/models/person";
import {
  PatientNetworkLinkResp,
  PatientLinkResp,
} from "@metriport/commonwell-sdk/lib/models/patient";
import { DocumentQueryResponse } from "@metriport/commonwell-sdk";
import * as stream from "stream";

import * as nanoid from "nanoid";

import {
  createPerson,
  createPatient,
  createPatientWithLinks,
  createPatientLink,
  createDocument,
} from "./sandbox-payloads";

const cwURL = "https://sandbox.rest.api.commonwellalliance.org";
const idAlphabet = "123456789";
export const primaryPatientId = nanoid.customAlphabet(idAlphabet, 6)();

export class CommonWellMock implements CommonWellAPI {
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

  //--------------------------------------------------------------------------------------------
  // Org Management
  //--------------------------------------------------------------------------------------------

  async createOrg(meta: RequestMetadata, organization: Organization): Promise<Organization> {
    return organization;
  }

  async updateOrg(meta: RequestMetadata, organization: Organization): Promise<Organization> {
    return organization;
  }

  // NOT USED YET
  async getAllOrgs() {
    return {};
  }

  // NOT USED YET
  async getOneOrg() {
    return {};
  }

  // USED BUT DOESNT RETURN ANYTHING YET
  async addCertificateToOrg() {
    return {};
  }

  // NOT USED YET
  async replaceCertificateForOrg() {
    return {};
  }

  // NOT USED YET
  async deleteCertificateFromOrg() {
    return;
  }

  // NOT USED YET
  async getCertificatesFromOrg() {
    return {};
  }

  // NOT USED YET
  async getCertificatesFromOrgByThumbprint() {
    return {};
  }

  // NOT USED YET
  async getCertificatesFromOrgByThumbprintAndPurpose() {
    return {};
  }

  //--------------------------------------------------------------------------------------------
  // Person Management
  //--------------------------------------------------------------------------------------------

  async enrollPerson(meta: RequestMetadata, person: Person): Promise<Person> {
    return person;
  }

  async searchPerson(
    meta: RequestMetadata,
    key: string,
    system: string
  ): Promise<PersonSearchResp> {
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
    meta: RequestMetadata,
    patientId: string
  ): Promise<PersonSearchResp> {
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

  async getPersonById(meta: RequestMetadata, personId: string): Promise<Person> {
    const person = createPerson(this._oid, this.orgName, personId);

    return person;
  }

  async updatePerson(meta: RequestMetadata, person: Person): Promise<Person> {
    return person;
  }

  // NOT USED YET
  async patientMatch() {
    return {};
  }

  // NOT USED YET (DEPRECATED)
  async patientLink() {
    return {};
  }

  async addPatientLink(
    meta: RequestMetadata,
    personId: string,
    patientUri: string
  ): Promise<PatientLink> {
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

  async reenrollPerson(meta: RequestMetadata, id: string): Promise<Person> {
    const person = createPerson(this._oid, this.orgName, id);
    return person;
  }

  // NOT USED YET
  async unenrollPerson() {
    return {};
  }

  // NOT USED YET
  async deletePerson() {
    return;
  }

  //--------------------------------------------------------------------------------------------
  // Patient Management
  //--------------------------------------------------------------------------------------------

  async registerPatient(meta: RequestMetadata, patient: Patient): Promise<Patient> {
    const patientWithLinks = createPatientWithLinks(patient);
    return patientWithLinks;
  }

  async getPatient(meta: RequestMetadata, id: string): Promise<Patient> {
    const patient = createPatient(this.oid, this.orgName, id);

    return patient;
  }

  // NOT USED YET
  async searchPatient() {
    return {};
  }

  async updatePatient(meta: RequestMetadata, patient: Patient): Promise<Patient> {
    const patientWithLinks = createPatientWithLinks(patient);
    return patientWithLinks;
  }

  // NOT USED YET
  async mergePatients() {
    return;
  }

  async getNetworkLinks(meta: RequestMetadata, patientId: string): Promise<PatientNetworkLinkResp> {
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
      _links: {},
    };
  }

  // NOT USED YET
  async deletePatient() {
    return;
  }

  //--------------------------------------------------------------------------------------------
  // Document Management
  //--------------------------------------------------------------------------------------------

  async queryDocuments(): Promise<DocumentQueryResponse> {
    const document = createDocument(this.oid, this.orgName);

    return document;
  }

  async retrieveDocument(
    meta: RequestMetadata,
    inputUrl: string,
    outputStream: stream.Writable
  ): Promise<void> {
    await downloadFile({
      url: inputUrl,
      outputStream,
    });

    return;
  }

  //--------------------------------------------------------------------------------------------
  // Link Management
  //--------------------------------------------------------------------------------------------

  // USED BUT DOESNT RETURN ANYTHING
  async upgradeOrDowngradeNetworkLink() {
    return {
      _links: {},
      assuranceLevel: "2",
      patient: {},
    };
  }

  // NOT USED YET
  async updatePatientLink() {
    return {};
  }

  async getPatientLinks(meta: RequestMetadata, personId: string): Promise<PatientLinkSearchResp> {
    const patientLinkUrl = `${cwURL}${CommonWellMock.PERSON_ENDPOINT}/${personId}/patientLink`;
    const patientLink = createPatientLink(patientLinkUrl, primaryPatientId, this.oid);

    return patientLink;
  }

  async getPatientLink(
    meta: RequestMetadata,
    personId: string,
    patientId: string
  ): Promise<PatientLinkResp> {
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
