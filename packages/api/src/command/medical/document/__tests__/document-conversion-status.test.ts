/* eslint-disable @typescript-eslint/no-empty-function */
import { makePatient, makePatientData } from "@metriport/core/domain/__tests__/patient";
import { MedicalDataSource } from "@metriport/core/external/index";
import { uuidv4 } from "@metriport/core/util/uuid-v7";
import * as getCQDataModule from "../../../../external/carequality/patient";
import * as getCWDataModule from "../../../../external/commonwell/patient/patient";
import * as tallyDocQueryProgressModule from "../../../../external/hie/tally-doc-query-progress";
import * as updateNetworkQueryStatusModule from "../../network-query/update-datasource-query-status";
import * as recreateConsolidatedModule from "../../patient/consolidated-recreate";
import { calculateDocumentConversionStatus } from "../document-conversion-status";

let updateSingleDatasourceQueryStatusSpy: jest.SpyInstance;
let getCQDataSpy: jest.SpyInstance;
let getCWDataSpy: jest.SpyInstance;

beforeEach(() => {
  jest.restoreAllMocks();
  updateSingleDatasourceQueryStatusSpy = jest
    .spyOn(updateNetworkQueryStatusModule, "updateSingleDatasourceQueryStatus")
    .mockResolvedValue({
      updatedCount: 1,
      patientsUpdated: [],
      patientsNotFound: [],
      updatedRequestIds: [],
    });
  jest.spyOn(recreateConsolidatedModule, "recreateConsolidated").mockResolvedValue();
  getCQDataSpy = jest.spyOn(getCQDataModule, "getCQData");
  getCWDataSpy = jest.spyOn(getCWDataModule, "getCWData");
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("calculateDocumentConversionStatus", () => {
  const cxId = uuidv4();
  const patientId = uuidv4();
  const requestId = uuidv4();
  const docId = uuidv4();

  describe("updateSingleDatasourceQueryStatus call", () => {
    it("calls updateSingleDatasourceQueryStatus with 'converted' when HIE conversion completes for CQ", async () => {
      const patient = makePatient({
        id: patientId,
        cxId,
        data: makePatientData({
          documentQueryProgress: {
            requestId,
            startedAt: new Date(),
            download: { status: "completed", total: 1, successful: 1, errors: 0 },
            convert: { status: "completed", total: 1, successful: 1, errors: 0 },
          },
          externalData: {
            CAREQUALITY: {
              documentQueryProgress: {
                requestId,
                startedAt: new Date(),
                download: { status: "completed", total: 1, successful: 1, errors: 0 },
                convert: { status: "completed", total: 1, successful: 1, errors: 0 },
              },
            },
          },
        }),
      });

      jest.spyOn(tallyDocQueryProgressModule, "tallyDocQueryProgress").mockResolvedValue(patient);

      getCQDataSpy.mockReturnValue({
        documentQueryProgress: {
          requestId,
          startedAt: new Date(),
          download: { status: "completed", total: 1, successful: 1, errors: 0 },
          convert: { status: "completed", total: 1, successful: 1, errors: 0 },
        },
      });

      await calculateDocumentConversionStatus({
        patientId,
        cxId,
        requestId,
        docId,
        source: MedicalDataSource.CAREQUALITY,
        convertResult: "success",
      });

      expect(updateSingleDatasourceQueryStatusSpy).toHaveBeenCalledWith({
        cxId,
        patientId,
        source: "hie",
        specificSource: "national-hie",
        toStatus: "converted",
        requestId,
      });
    });

    it("calls updateSingleDatasourceQueryStatus with 'converted' when HIE conversion completes for CW", async () => {
      const patient = makePatient({
        id: patientId,
        cxId,
        data: makePatientData({
          documentQueryProgress: {
            requestId,
            startedAt: new Date(),
            download: { status: "completed", total: 1, successful: 1, errors: 0 },
            convert: { status: "completed", total: 1, successful: 1, errors: 0 },
          },
          externalData: {
            COMMONWELL: {
              documentQueryProgress: {
                requestId,
                startedAt: new Date(),
                download: { status: "completed", total: 1, successful: 1, errors: 0 },
                convert: { status: "completed", total: 1, successful: 1, errors: 0 },
              },
            },
          },
        }),
      });

      jest.spyOn(tallyDocQueryProgressModule, "tallyDocQueryProgress").mockResolvedValue(patient);

      getCWDataSpy.mockReturnValue({
        documentQueryProgress: {
          requestId,
          startedAt: new Date(),
          download: { status: "completed", total: 1, successful: 1, errors: 0 },
          convert: { status: "completed", total: 1, successful: 1, errors: 0 },
        },
      });

      await calculateDocumentConversionStatus({
        patientId,
        cxId,
        requestId,
        docId,
        source: MedicalDataSource.COMMONWELL,
        convertResult: "success",
      });

      expect(updateSingleDatasourceQueryStatusSpy).toHaveBeenCalledWith({
        cxId,
        patientId,
        source: "hie",
        specificSource: "national-hie",
        toStatus: "converted",
        requestId,
      });
    });

    it("does NOT call updateSingleDatasourceQueryStatus when conversion is still in progress", async () => {
      const patient = makePatient({
        id: patientId,
        cxId,
        data: makePatientData({
          documentQueryProgress: {
            requestId,
            startedAt: new Date(),
            download: { status: "completed", total: 2, successful: 2, errors: 0 },
            convert: { status: "processing", total: 2, successful: 1, errors: 0 },
          },
          externalData: {
            CAREQUALITY: {
              documentQueryProgress: {
                requestId,
                startedAt: new Date(),
                download: { status: "completed", total: 2, successful: 2, errors: 0 },
                convert: { status: "processing", total: 2, successful: 1, errors: 0 },
              },
            },
          },
        }),
      });

      jest.spyOn(tallyDocQueryProgressModule, "tallyDocQueryProgress").mockResolvedValue(patient);

      getCQDataSpy.mockReturnValue({
        documentQueryProgress: {
          requestId,
          startedAt: new Date(),
          download: { status: "completed", total: 2, successful: 2, errors: 0 },
          convert: { status: "processing", total: 2, successful: 1, errors: 0 },
        },
      });

      await calculateDocumentConversionStatus({
        patientId,
        cxId,
        requestId,
        docId,
        source: MedicalDataSource.CAREQUALITY,
        convertResult: "success",
      });

      expect(updateSingleDatasourceQueryStatusSpy).not.toHaveBeenCalled();
    });
  });
});
