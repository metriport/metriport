import { AppPatientBlocker } from "../mpi/block-patients";
import { makeBlockerFactory } from "@metriport/core/external/mpi/patient-blocker";
import { GenderAtBirth } from "../../../../domain/medical/patient";
import { PatientModel } from "../../../../models/medical/patient";
import { Op } from "sequelize";

jest.mock("../../../../models/medical/patient");

const mockPatients = [
  {
    cxId: "1",
    facilityIds: ["1"],
    data: { dob: "2000-01-01", genderAtBirth: "M", firstName: "Adam", lastName: "Smith" },
  },
  {
    cxId: "2",
    facilityIds: ["2"],
    data: { dob: "1990-01-01", genderAtBirth: "F", firstName: "Bill", lastName: "Burr" },
  },
];

const patientBlocker = makeBlockerFactory(AppPatientBlocker);

/* This is a test suite for the `patientBlocker.block` function. It tests the validity of different criteria passed into patientBlocker.block */
describe("patientBlocker.block", () => {
  let findAllMock: jest.SpyInstance;

  beforeEach(() => {
    jest.restoreAllMocks();
    findAllMock = jest.spyOn(PatientModel, "findAll");
  });

  it("should return patients based on cxId", async () => {
    findAllMock.mockResolvedValueOnce([mockPatients[0]]);
    const criteria = { cxId: "1" };
    const result = await patientBlocker.block(criteria);

    expect(result).toEqual([mockPatients[0]]);
    expect(findAllMock).toHaveBeenCalledWith({ where: criteria });
  });

  it("should return patients based on facilityIds", async () => {
    findAllMock.mockResolvedValueOnce([mockPatients[1]]);
    const criteria = { facilityIds: ["2"] };
    const result = await patientBlocker.block(criteria);

    expect(result).toEqual([mockPatients[1]]);
    expect(findAllMock).toHaveBeenCalledWith({ where: criteria });
  });

  it("should return patients based on dob", async () => {
    findAllMock.mockResolvedValueOnce([mockPatients[1]]);
    const criteria = { data: { dob: "1990-01-01" } };
    const result = await patientBlocker.block(criteria);

    expect(result).toEqual([mockPatients[1]]);
    expect(findAllMock).toHaveBeenCalledWith({
      where: {
        "data.dob": "1990-01-01",
      },
    });
  });

  it("should return patients based on genderAtBirth", async () => {
    findAllMock.mockResolvedValueOnce([mockPatients[0]]);
    const criteria = { data: { genderAtBirth: "M" as GenderAtBirth } };
    const result = await patientBlocker.block(criteria);

    expect(result).toEqual([mockPatients[0]]);
    expect(findAllMock).toHaveBeenCalledWith({
      where: {
        "data.genderAtBirth": "M",
      },
    });
  });

  it("should return empty array when no patients match the criteria", async () => {
    findAllMock.mockResolvedValueOnce([]);
    const criteria = { cxId: "3" };
    const result = await patientBlocker.block(criteria);

    expect(result).toEqual([]);
    expect(findAllMock).toHaveBeenCalledWith({ where: criteria });
  });
  it("should return patients based on first letter of first name", async () => {
    // Mock a patient whose first name starts with 'A'
    findAllMock.mockResolvedValueOnce([mockPatients[0]]);

    const criteria = { data: { firstNameInitial: "A" } };
    const result = await patientBlocker.block(criteria);

    expect(result).toEqual([mockPatients[0]]);
    expect(findAllMock).toHaveBeenCalledWith({ where: { "data.firstName": { [Op.like]: "A%" } } });
  });

  it("should return patients based on first letter of last name", async () => {
    // Mock a patient whose last name starts with 'B'
    findAllMock.mockResolvedValueOnce([mockPatients[1]]);

    const criteria = { data: { lastNameInitial: "B" } };
    const result = await patientBlocker.block(criteria);

    expect(result).toEqual([mockPatients[1]]);
    expect(findAllMock).toHaveBeenCalledWith({ where: { "data.lastName": { [Op.like]: "B%" } } });
  });
});
