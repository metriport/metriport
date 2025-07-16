/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  Demographics,
  DocumentQueryFullResponse,
  DocumentReference,
  Patient,
  PatientCollection,
  PatientCollectionItem,
  PatientProbableLinkResp,
  StatusResponse,
  statusResponseSchema,
} from "@metriport/commonwell-sdk";
import {
  BaseOptions,
  CommonWellAPI,
  DocumentQueryParams,
  GetPatientParams,
  RetrieveDocumentResponse,
} from "@metriport/commonwell-sdk/client/commonwell-api";
import { encodeToCwPatientId } from "@metriport/commonwell-sdk/common/util";
import { nanoid } from "nanoid";
import * as stream from "stream";
import {
  createDocument,
  createPatientCollectionItem,
  createProbablePatient,
  cwURL,
} from "./payloads";

const docRefUrl = "/v2/documentReference";

export class CommonWellMock implements CommonWellAPI {
  private orgName: string;
  private _oid: string;

  constructor(orgName: string, oid: string) {
    this.orgName = orgName;
    this._oid = oid;
  }

  get oid() {
    return this._oid;
  }
  get lastTransactionId() {
    return undefined;
  }

  async createOrUpdatePatient(patient: Patient, options?: BaseOptions): Promise<PatientCollection> {
    const patientId = patient.identifier[0]?.value;
    if (!patientId) throw new Error("Patient ID is required (under identifier[0].value)");
    return {
      Patients: [createPatientCollectionItem(this.oid, this.orgName, patientId)],
      status: {
        message: "Success",
        code: 200,
      },
    };
  }

  async getPatient(
    params: GetPatientParams,
    options?: BaseOptions
  ): Promise<PatientCollectionItem | undefined>;
  async getPatient(id: string, options?: BaseOptions): Promise<PatientCollectionItem | undefined>;
  async getPatient(
    idOrParams: string | GetPatientParams,
    options?: BaseOptions
  ): Promise<PatientCollectionItem | undefined> {
    let patientId: string;
    if (typeof idOrParams !== "string") {
      patientId = idOrParams.id;
      const { assignAuthority, assignAuthorityType } = idOrParams;
      patientId = encodeToCwPatientId({
        patientId,
        assignAuthority,
        assignAuthorityType,
      });
    } else {
      if (!idOrParams) {
        throw new Error("Programming error, 'id' is required when providing separated parametrs");
      }
      patientId = idOrParams;
    }
    return createPatientCollectionItem(this.oid, this.orgName, patientId);
  }

  async deletePatient(patientId: string, options?: BaseOptions): Promise<void> {
    return;
  }

  //--------------------------------------------------------------------------------------------
  // Link Management
  //--------------------------------------------------------------------------------------------

  async mergePatients(
    {
      nonSurvivingPatientId,
      survivingPatientId,
    }: {
      nonSurvivingPatientId: string;
      survivingPatientId: string;
    },
    options?: BaseOptions
  ): Promise<StatusResponse> {
    return statusResponseSchema.parse({ status: "success" });
  }

  async getPatientLinksByPatientId(
    patientId: string,
    options?: BaseOptions
  ): Promise<PatientCollection> {
    return {
      Patients: [
        createPatientCollectionItem(this.oid, this.orgName, patientId),
        createPatientCollectionItem(this.oid, this.orgName, patientId),
      ],
      status: {
        message: "Success",
        code: 200,
      },
    };
  }

  async getProbableLinksById(
    patientId: string,
    options?: BaseOptions
  ): Promise<PatientProbableLinkResp> {
    return {
      Patients: [
        createProbablePatient(this.oid, this.orgName, patientId),
        createProbablePatient(this.oid, this.orgName, patientId),
      ],
      status: {
        message: "Success",
        code: 200,
      },
    };
  }

  async getProbableLinksByDemographics(
    {
      firstName,
      lastName,
      dob,
      gender,
      zip,
    }: {
      firstName: string;
      lastName: string;
      dob: string;
      gender: string;
      zip: string;
    },
    options?: BaseOptions
  ): Promise<PatientProbableLinkResp> {
    const demographics: Partial<Demographics> = {
      name: [{ given: [firstName], family: [lastName] }],
      birthDate: dob,
      gender,
      address: [{ postalCode: zip }],
    };
    const patient1 = createProbablePatient(this.oid, this.orgName, nanoid(), demographics);
    const patient2 = createProbablePatient(this.oid, this.orgName, nanoid(), demographics);
    return {
      Patients: [patient1, patient2],
      status: {
        message: "Success",
        code: 200,
      },
    };
  }

  async linkPatients(urlToLinkPatients: string, options?: BaseOptions): Promise<StatusResponse> {
    return statusResponseSchema.parse({ status: "success" });
  }

  async unlinkPatients(
    urlToUnlinkPatients: string,
    options?: BaseOptions
  ): Promise<StatusResponse> {
    return statusResponseSchema.parse({ status: "success" });
  }

  async resetPatientLinks(
    urlToResetPatientLinks: string,
    options?: BaseOptions
  ): Promise<StatusResponse> {
    return statusResponseSchema.parse({ status: "success" });
  }

  //--------------------------------------------------------------------------------------------
  // Document Management
  //--------------------------------------------------------------------------------------------

  async queryDocuments(
    patientId: string,
    options?: BaseOptions & DocumentQueryParams
    //eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): Promise<DocumentReference[]> {
    return [createDocument(this.oid, this.orgName)];
  }
  async queryDocumentsFull(
    patientId: string,
    options?: BaseOptions & DocumentQueryParams
    //eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): Promise<DocumentQueryFullResponse> {
    const docRef = createDocument(this.oid, this.orgName);
    return {
      resourceType: "Bundle",
      entry: [
        {
          fullUrl: `${cwURL}${docRefUrl}/${docRef.id}`,
          resource: docRef,
        },
      ],
    };
  }

  async retrieveDocument(
    inputUrl: string,
    outputStream: stream.Writable,
    options?: BaseOptions
  ): Promise<RetrieveDocumentResponse> {
    return {
      contentType: "application/pdf",
      size: 1000,
    };
  }
}
