/* eslint-disable @typescript-eslint/no-empty-function */
import { faker } from "@faker-js/faker";
import { MedicalDataSource } from "../../../external";
import { ConversionResultLocal } from "../conversion-result-local";
import { sendConversionResults } from "../send-multiple-conversion-results";
import { ConversionResult } from "../types";

describe("sendConversionResults", () => {
  const apiUrl = "https://api.metriport.com";
  const cxId = faker.string.uuid();
  const patientId = faker.string.uuid();
  const mockResults: ConversionResult[] = [
    { cxId, patientId, status: "success", source: MedicalDataSource.COMMONWELL },
  ];
  let notifyApi_mock: jest.SpyInstance;

  beforeAll(() => {
    notifyApi_mock = jest
      .spyOn(ConversionResultLocal.prototype, "notifyApi")
      .mockImplementation(() => Promise.resolve());
  });
  afterEach(() => {
    notifyApi_mock.mockClear();
  });

  it("sends a single result with count", async () => {
    const expectedResult = {
      ...mockResults[0],
      count: mockResults.length,
    };
    const res = await sendConversionResults({ results: mockResults, apiUrl });
    expect(res).toEqual([expectedResult]);
    expect(notifyApi_mock).toHaveBeenCalledWith(expectedResult, expect.any(Function));
  });

  it("groups multiple results for the same patient/source/status", async () => {
    const multipleResults: ConversionResult[] = [
      ...mockResults,
      { cxId, patientId, status: "success", source: MedicalDataSource.COMMONWELL },
      { cxId, patientId, status: "success", source: MedicalDataSource.COMMONWELL },
    ];
    const expectedResult = {
      ...mockResults[0],
      count: multipleResults.length,
    };
    const res = await sendConversionResults({ results: multipleResults, apiUrl });
    expect(res).toEqual([expectedResult]);
    expect(notifyApi_mock).toHaveBeenCalledTimes(1);
    expect(notifyApi_mock).toHaveBeenCalledWith(
      expect.objectContaining(expectedResult),
      expect.any(Function)
    );
  });

  it("handles multiple results for different patients", async () => {
    const patient2Id = faker.string.uuid();
    const multipleResults: ConversionResult[] = [
      ...mockResults,
      { cxId, patientId: patient2Id, status: "success", source: MedicalDataSource.COMMONWELL },
    ];
    const expectedResults = [
      { ...multipleResults[0], count: 1 },
      { ...multipleResults[1], count: 1 },
    ];
    const res = await sendConversionResults({ results: multipleResults, apiUrl });
    expect(res).toEqual(expectedResults);
    expect(notifyApi_mock).toHaveBeenCalledTimes(2);
    expect(notifyApi_mock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining(multipleResults[0]),
      expect.any(Function)
    );
    expect(notifyApi_mock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining(multipleResults[1]),
      expect.any(Function)
    );
  });
  it("handles API errors gracefully and returns the results that did not fail", async () => {
    const multipleResults: ConversionResult[] = [
      ...mockResults,
      { cxId, patientId, status: "failed", source: MedicalDataSource.CAREQUALITY },
    ];
    const expectedResult = {
      ...multipleResults[1],
      count: 1,
    };
    notifyApi_mock.mockRejectedValueOnce(new Error("API Error"));
    const res = await sendConversionResults({ results: multipleResults, apiUrl });
    expect(res).toEqual([expectedResult]);
    expect(notifyApi_mock).toHaveBeenCalledTimes(2);
    expect(notifyApi_mock).toHaveBeenCalledWith(
      expect.objectContaining(multipleResults[0]),
      expect.any(Function)
    );
    expect(notifyApi_mock).toHaveBeenCalledWith(
      expect.objectContaining(multipleResults[1]),
      expect.any(Function)
    );
  });

  it("returns empty array when no results are provided", async () => {
    const res = await sendConversionResults({ results: [], apiUrl });
    expect(res).toEqual([]);
    expect(notifyApi_mock).not.toHaveBeenCalled();
  });

  it("groups results by different sources for the same patient", async () => {
    const multipleResults: ConversionResult[] = [
      { cxId, patientId, status: "success", source: MedicalDataSource.COMMONWELL },
      { cxId, patientId, status: "success", source: MedicalDataSource.CAREQUALITY },
    ];
    const expectedResults = [
      { ...multipleResults[0], count: 1 },
      { ...multipleResults[1], count: 1 },
    ];
    const res = await sendConversionResults({ results: multipleResults, apiUrl });
    expect(res).toEqual(expectedResults);
    expect(notifyApi_mock).toHaveBeenCalledTimes(2);
    expect(notifyApi_mock).toHaveBeenCalledWith(
      expect.objectContaining(multipleResults[0]),
      expect.any(Function)
    );
    expect(notifyApi_mock).toHaveBeenCalledWith(
      expect.objectContaining(multipleResults[1]),
      expect.any(Function)
    );
  });

  it("groups results by different statuses for the same patient and source", async () => {
    const multipleResults: ConversionResult[] = [
      { cxId, patientId, status: "success", source: MedicalDataSource.COMMONWELL },
      { cxId, patientId, status: "failed", source: MedicalDataSource.COMMONWELL },
      { cxId, patientId, status: "success", source: MedicalDataSource.COMMONWELL },
    ];
    const expectedResults = [
      { ...multipleResults[0], count: 2 },
      { ...multipleResults[1], count: 1 },
    ];
    const res = await sendConversionResults({ results: multipleResults, apiUrl });
    expect(res).toEqual(expectedResults);
    expect(notifyApi_mock).toHaveBeenCalledTimes(2);
    expect(notifyApi_mock).toHaveBeenCalledWith(
      expect.objectContaining(multipleResults[0]),
      expect.any(Function)
    );
    expect(notifyApi_mock).toHaveBeenCalledWith(
      expect.objectContaining(multipleResults[1]),
      expect.any(Function)
    );
  });

  it("handles complex combinations of sources and statuses", async () => {
    const multipleResults: ConversionResult[] = [
      { cxId, patientId, status: "success", source: MedicalDataSource.COMMONWELL },
      { cxId, patientId, status: "failed", source: MedicalDataSource.COMMONWELL },
      { cxId, patientId, status: "success", source: MedicalDataSource.CAREQUALITY },
      { cxId, patientId, status: "failed", source: MedicalDataSource.CAREQUALITY },
      { cxId, patientId, status: "success", source: MedicalDataSource.COMMONWELL },
    ];
    const expectedResults = [
      { ...multipleResults[0], count: 2 },
      { ...multipleResults[1], count: 1 },
      { ...multipleResults[2], count: 1 },
      { ...multipleResults[3], count: 1 },
    ];
    const res = await sendConversionResults({ results: multipleResults, apiUrl });
    expect(res).toEqual(expectedResults);
    expect(notifyApi_mock).toHaveBeenCalledTimes(4);
    expect(notifyApi_mock).toHaveBeenCalledWith(
      expect.objectContaining(multipleResults[0]),
      expect.any(Function)
    );
    expect(notifyApi_mock).toHaveBeenCalledWith(
      expect.objectContaining(multipleResults[1]),
      expect.any(Function)
    );
    expect(notifyApi_mock).toHaveBeenCalledWith(
      expect.objectContaining(multipleResults[2]),
      expect.any(Function)
    );
    expect(notifyApi_mock).toHaveBeenCalledWith(
      expect.objectContaining(multipleResults[3]),
      expect.any(Function)
    );
  });
});
