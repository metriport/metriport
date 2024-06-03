/* eslint-disable @typescript-eslint/no-empty-function */
import { Patient, ConsolidatedLinkDemographics } from "@metriport/core/domain/patient";
import { PatientModel } from "../../../models/medical/patient";
import {
  LinkDemographics,
  LinkDemographicsHistory,
} from "@metriport/core/domain/patient-demographics";
import { MedicalDataSource } from "@metriport/core/external/index";
import { makePatient, makePatientData } from "../../../domain/medical/__tests__/patient";
import { mockStartTransaction } from "../../../models/__tests__/transaction";
import { PatientDataCommonwell } from "../../commonwell/patient-shared";
import {
  normalizeDob,
  normalizeGender,
  normalizeAndStringifyNames,
  normalizeAddress,
  stringifyAddress,
  normalizeTelephone,
  normalizeSsn,
  normalizeEmail,
  normalizeAndStringifyDriversLicense,
} from "../../../domain/medical/patient-demographics";
import { updatePatientLinkDemographics } from "../update-patient-link-demographics";

let patient: Patient;
let patientModel: PatientModel;

let patientModel_findOne: jest.SpyInstance;
let patientModel_update: jest.SpyInstance;

beforeEach(() => {
  mockStartTransaction();
  patientModel = patient as unknown as PatientModel;
  patientModel_findOne = jest.spyOn(PatientModel, "findOne").mockResolvedValue(patientModel);
  patientModel_update = jest.spyOn(PatientModel, "update").mockImplementation(async () => [1]);
});

afterEach(() => {
  jest.clearAllMocks();
});

const checkPatientUpdateWith = ({
  newHieValues,
  newConsolidatedValue,
}: {
  newHieValues: LinkDemographicsHistory;
  newConsolidatedValue: ConsolidatedLinkDemographics;
}) => {
  expect(patientModel_update).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({
        externalData: expect.objectContaining({
          COMMONWELL: expect.objectContaining({
            linkDemographics: expect.objectContaining(newHieValues),
          }),
        }),
        consolidatedLinkDemographics: expect.objectContaining(newConsolidatedValue),
      }),
    }),
    expect.anything()
  );
};

describe("update patient demographics", () => {
  const source = MedicalDataSource.COMMONWELL;
  const newRequestId = "test";
  const newLinkDemographics = {
    dob: normalizeDob("1900-01-01"),
    gender: normalizeGender("male"),
    names: [normalizeAndStringifyNames({ firstName: "john", lastName: "smith" })],
    addresses: [
      stringifyAddress(
        normalizeAddress({
          line: ["1 mordhaus st", "apt 1a", "2"],
          city: "mordhaus",
          state: "ny",
          zip: "66666",
          country: "usa",
        })
      ),
    ],
    telephoneNumbers: [normalizeTelephone("+1(999)999-9999")],
    emails: [normalizeEmail("john.smith@gmail.com")],
    driversLicenses: [normalizeAndStringifyDriversLicense({ value: "I1234567", state: "CA" })],
    ssns: [normalizeSsn("000-00-0000")],
  };
  it("update patient with no link demograhpics", async () => {
    const patient = makePatient();
    patientModel_findOne.mockResolvedValueOnce(patient);
    const links: LinkDemographics[] = [newLinkDemographics];
    await updatePatientLinkDemographics({
      requestId: newRequestId,
      patient,
      source,
      links,
    });
    checkPatientUpdateWith({
      newHieValues: {
        [newRequestId]: links,
      },
      newConsolidatedValue: {
        names: links[0].names.sort(),
        addresses: links[0].addresses.sort(),
        telephoneNumbers: links[0].telephoneNumbers.sort(),
        emails: links[0].emails.sort(),
        driversLicenses: links[0].driversLicenses.sort(),
        ssns: links[0].ssns.sort(),
      },
    });
  });
  it("update patient with existing initial link demograhpics", async () => {
    const existingLinkDemographcsics = {
      dob: normalizeDob("1900-01-01"),
      gender: normalizeGender("male"),
      names: [normalizeAndStringifyNames({ firstName: "jon", lastName: "smith" })],
      addresses: [
        stringifyAddress(
          normalizeAddress({
            line: ["777 bedlam st"],
            city: "san francisco",
            state: "ca",
            zip: "98765",
            country: "usa",
          })
        ),
      ],
      telephoneNumbers: [normalizeTelephone("+1(415)100-1010")],
      emails: [normalizeEmail("john.smith@gmail.com")],
      driversLicenses: [normalizeAndStringifyDriversLicense({ value: "I1234567", state: "CA" })],
      ssns: [normalizeSsn("000-00-0000")],
    };
    const existingCwExternalData: PatientDataCommonwell = {
      patientId: "base",
      linkDemographics: {
        existing: [existingLinkDemographcsics],
      },
    };
    const patientData = makePatientData({
      externalData: {
        COMMONWELL: existingCwExternalData,
      },
      consolidatedLinkDemographics: {
        names: existingLinkDemographcsics.names,
        addresses: existingLinkDemographcsics.addresses,
        telephoneNumbers: existingLinkDemographcsics.telephoneNumbers,
        emails: existingLinkDemographcsics.emails,
        driversLicenses: existingLinkDemographcsics.driversLicenses,
        ssns: existingLinkDemographcsics.ssns,
      },
    });
    const patient = makePatient({ data: patientData });
    patientModel_findOne.mockResolvedValueOnce(patient);
    const links: LinkDemographics[] = [newLinkDemographics];
    await updatePatientLinkDemographics({
      requestId: newRequestId,
      patient,
      source,
      links,
    });
    checkPatientUpdateWith({
      newHieValues: {
        [newRequestId]: links,
        existing: [existingLinkDemographcsics],
      },
      newConsolidatedValue: {
        names: [
          ...new Set([
            ...links.flatMap(ld => ld.names),
            ...(patient.data.consolidatedLinkDemographics?.names ?? []),
          ]),
        ].sort(),
        addresses: [
          ...new Set([
            ...links.flatMap(ld => ld.addresses),
            ...(patient.data.consolidatedLinkDemographics?.addresses ?? []),
          ]),
        ].sort(),
        telephoneNumbers: [
          ...new Set([
            ...links.flatMap(ld => ld.telephoneNumbers),
            ...(patient.data.consolidatedLinkDemographics?.telephoneNumbers ?? []),
          ]),
        ].sort(),
        emails: [
          ...new Set([
            ...links.flatMap(ld => ld.emails),
            ...(patient.data.consolidatedLinkDemographics?.emails ?? []),
          ]),
        ].sort(),
        driversLicenses: [
          ...new Set([
            ...links.flatMap(ld => ld.driversLicenses),
            ...(patient.data.consolidatedLinkDemographics?.driversLicenses ?? []),
          ]),
        ].sort(),
        ssns: [
          ...new Set([
            ...links.flatMap(ld => ld.ssns),
            ...(patient.data.consolidatedLinkDemographics?.ssns ?? []),
          ]),
        ].sort(),
      },
    });
  });
});
