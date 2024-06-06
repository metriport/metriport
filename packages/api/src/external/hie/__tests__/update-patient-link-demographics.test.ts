/* eslint-disable @typescript-eslint/no-empty-function */
import { Patient, ConsolidatedLinkDemographics } from "@metriport/core/domain/patient";
import { PatientModel } from "../../../models/medical/patient";
import { LinkDemographics } from "@metriport/core/domain/patient-demographics";
import { MedicalDataSource } from "@metriport/core/external/index";
import { makePatient, makePatientData } from "../../../domain/medical/__tests__/patient";
import { linkDemographics } from "../../../domain/medical/__tests__/deomgraphics.const";
import { mockStartTransaction } from "../../../models/__tests__/transaction";
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

const checkPatientUpdateWith = (newConsolidatedValue: ConsolidatedLinkDemographics) => {
  expect(patientModel_update).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({
        consolidatedLinkDemographics: newConsolidatedValue,
      }),
    }),
    expect.anything()
  );
};

describe("update patient link demographics", () => {
  const source = MedicalDataSource.COMMONWELL;
  const newRequestId = "test";
  it("update patient with no existing link demograhpics", async () => {
    const patient = makePatient();
    patientModel_findOne.mockResolvedValueOnce(patient);
    const links: LinkDemographics[] = [linkDemographics];
    await updatePatientLinkDemographics({
      requestId: newRequestId,
      patient,
      source,
      links,
    });
    checkPatientUpdateWith({
      names: links[0].names.sort(),
      addresses: links[0].addresses.sort(),
      telephoneNumbers: links[0].telephoneNumbers.sort(),
      emails: links[0].emails.sort(),
      driversLicenses: links[0].driversLicenses.sort(),
      ssns: links[0].ssns.sort(),
    });
  });
  it("update patient with existing initial link demograhpics", async () => {
    const existingLinkDemographcsics: ConsolidatedLinkDemographics = {
      names: [
        { firstName: "john", lastName: "smith" },
        { firstName: "johnathan", lastName: "smith" },
      ].map(name => JSON.stringify(name, Object.keys(name).sort())),
      addresses: [
        {
          line: ["88 75th st.", "apt 8"],
          city: "san francisco",
          state: "ca",
          zip: "99999",
          country: "usa",
        },
      ].map(address => JSON.stringify(address, Object.keys(address).sort())),
      telephoneNumbers: ["4150000000"],
      emails: ["johnathan.smith@gmail.com"],
      driversLicenses: [{ value: "ny1234", state: "ny" }].map(dl =>
        JSON.stringify(dl, Object.keys(dl).sort())
      ),
      ssns: ["123456789"],
    };
    const patientData = makePatientData({
      consolidatedLinkDemographics: existingLinkDemographcsics,
    });
    const patient = makePatient({ data: patientData });
    patientModel_findOne.mockResolvedValueOnce(patient);
    const links: LinkDemographics[] = [linkDemographics];
    await updatePatientLinkDemographics({
      requestId: newRequestId,
      patient,
      source,
      links,
    });
    checkPatientUpdateWith({
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
    });
  });
});
