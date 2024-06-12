/* eslint-disable @typescript-eslint/no-empty-function */
import { CQPatientDataModel } from "../models/cq-patient-data";
import { LinkDemographicsHistory } from "@metriport/core/domain/patient-demographics";
import { makeCqDataLink, makeLinksHistory, makeCqPatientData } from "./cq-patient-data";
import { mockStartTransaction } from "../../../models/__tests__/transaction";
import { CQLink } from "../cq-patient-data";
import { createOrUpdateCQPatientData } from "../command/cq-patient-data/create-cq-data";

let cqPatientModel_findOne: jest.SpyInstance;
let cqPatientModel_update: jest.SpyInstance;

const mockUpdate = jest.fn();

beforeEach(() => {
  mockStartTransaction();
  cqPatientModel_findOne = jest.spyOn(CQPatientDataModel, "findOne");
  cqPatientModel_update = mockUpdate.mockImplementation(async () => [1]);
});

afterEach(() => {
  jest.clearAllMocks();
});

const checkPatientUpdateWith = ({
  newLinks,
  newLinksDemographicsHistory,
}: {
  newLinks: CQLink[];
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
    const cqPatientData = makeCqPatientData({
      data: {
        links: [],
      },
    });
    cqPatientModel_findOne.mockResolvedValueOnce({
      ...cqPatientData,
      update: mockUpdate,
    });
    const newLinks = [makeCqDataLink()];
    const newLinksDemographicsHistory = makeLinksHistory();
    const requestId = Object.keys(newLinksDemographicsHistory)[0];
    const linksDemographics = Object.values(newLinksDemographicsHistory)[0];
    await createOrUpdateCQPatientData({
      id: cqPatientData.id,
      cxId: cqPatientData.cxId,
      cqLinks: newLinks,
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
    const existingCqLinks = [makeCqDataLink()];
    const existingLinksDemographicsHistory = makeLinksHistory();
    const cqPatientData = makeCqPatientData({
      data: {
        links: existingCqLinks,
        linkDemographicsHistory: existingLinksDemographicsHistory,
      },
    });
    cqPatientModel_findOne.mockResolvedValueOnce({
      ...cqPatientData,
      update: mockUpdate,
    });
    const newLinks = [makeCqDataLink()];
    const newLinksDemographicsHistory = makeLinksHistory();
    const requestId = Object.keys(newLinksDemographicsHistory)[0];
    const linksDemographics = Object.values(newLinksDemographicsHistory)[0];
    await createOrUpdateCQPatientData({
      id: cqPatientData.id,
      cxId: cqPatientData.cxId,
      cqLinks: newLinks,
      requestLinksDemographics: {
        requestId,
        linksDemographics,
      },
    });
    checkPatientUpdateWith({
      newLinks: [...existingCqLinks, ...newLinks],
      newLinksDemographicsHistory: {
        ...existingLinksDemographicsHistory,
        ...newLinksDemographicsHistory,
      },
    });
  });
});
