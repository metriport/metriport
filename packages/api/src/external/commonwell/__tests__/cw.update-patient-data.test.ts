/* eslint-disable @typescript-eslint/no-empty-function */
import { CwPatientDataModel } from "../models/cw-patient-data";
import { LinkDemographicsHistory } from "@metriport/core/domain/patient-demographics";
import { makeCwDataLink, makeLinksHistory, makeCwPatientData } from "./cw-patient-data";
import { mockStartTransaction } from "../../../models/__tests__/transaction";
import { CwLink } from "../cw-patient-data";
import { createOrUpdateCwPatientData } from "../command/cw-patient-data/create-cw-data";

let cqPatientModel_findOne: jest.SpyInstance;
let cqPatientModel_update: jest.SpyInstance;

const mockUpdate = jest.fn();

beforeEach(() => {
  mockStartTransaction();
  cqPatientModel_findOne = jest.spyOn(CwPatientDataModel, "findOne");
  cqPatientModel_update = mockUpdate.mockImplementation(async () => [1]);
});

afterEach(() => {
  jest.clearAllMocks();
});

const checkPatientUpdateWith = ({
  newLinks,
  newLinksDemographicsHistory,
}: {
  newLinks: CwLink[];
  newLinksDemographicsHistory: LinkDemographicsHistory;
}) => {
  expect(cqPatientModel_update).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({
        links: expect.objectContaining(newLinks),
        linkDemographicsHistory: expect.objectContaining(newLinksDemographicsHistory),
      }),
    }),
    expect.anything()
  );
};

describe("update cq data", () => {
  it("update patient with no link demographics", async () => {
    const cqPatientData = makeCwPatientData({
      data: {
        links: [],
      },
    });
    cqPatientModel_findOne.mockResolvedValueOnce({
      ...cqPatientData,
      update: mockUpdate,
    });
    const newLinks = [makeCwDataLink()];
    const newLinksDemographicsHistory = makeLinksHistory();
    const requestId = Object.keys(newLinksDemographicsHistory)[0];
    const linksDemographics = Object.values(newLinksDemographicsHistory)[0];
    await createOrUpdateCwPatientData({
      id: cqPatientData.id,
      cxId: cqPatientData.cxId,
      cwLinks: newLinks,
      requestLinksDemographics: {
        requestId,
        linksDemographics,
      },
    });
    checkPatientUpdateWith({
      newLinks,
      newLinksDemographicsHistory,
    });
  });
  it("update patient with existing initial link demographics", async () => {
    const existingCwLinks = [makeCwDataLink()];
    const existingLinksDemographicsHistory = makeLinksHistory();
    const cqPatientData = makeCwPatientData({
      data: {
        links: existingCwLinks,
        linkDemographicsHistory: existingLinksDemographicsHistory,
      },
    });
    cqPatientModel_findOne.mockResolvedValueOnce({
      ...cqPatientData,
      update: mockUpdate,
    });
    const newLinks = [makeCwDataLink()];
    const newLinksDemographicsHistory = makeLinksHistory();
    const requestId = Object.keys(newLinksDemographicsHistory)[0];
    const linksDemographics = Object.values(newLinksDemographicsHistory)[0];
    await createOrUpdateCwPatientData({
      id: cqPatientData.id,
      cxId: cqPatientData.cxId,
      cwLinks: newLinks,
      requestLinksDemographics: {
        requestId,
        linksDemographics,
      },
    });
    checkPatientUpdateWith({
      newLinks: [...existingCwLinks, ...newLinks],
      newLinksDemographicsHistory: {
        ...existingLinksDemographicsHistory,
        ...newLinksDemographicsHistory,
      },
    });
  });
});
