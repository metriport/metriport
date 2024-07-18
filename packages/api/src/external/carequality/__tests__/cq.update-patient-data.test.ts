/* eslint-disable @typescript-eslint/no-empty-function */
import { CQPatientDataModel } from "../models/cq-patient-data";
import { LinkDemographicsHistory } from "@metriport/core/domain/patient-demographics";
import { makeCqDataLink, makeLinksHistory, makeCqPatientData } from "./cq-patient-data";
import { makePatient } from "../../../domain/medical/__tests__/patient";
import { mockStartTransaction } from "../../../models/__tests__/transaction";
import { CQLink } from "../cq-patient-data";
import { createOrUpdateCQPatientData } from "../command/cq-patient-data/create-cq-data";
import { updateCQPatientData } from "../command/cq-patient-data/update-cq-data";

let cqPatientModel_findOne: jest.SpyInstance;
let cqPatientModel_create: jest.SpyInstance;
let cqPatientModel_update: jest.SpyInstance;

const mockUpdate = jest.fn();

beforeEach(() => {
  mockStartTransaction();
  cqPatientModel_findOne = jest.spyOn(CQPatientDataModel, "findOne");
  cqPatientModel_create = jest
    .spyOn(CQPatientDataModel, "create")
    .mockImplementation(async () => [1]);
  cqPatientModel_update = mockUpdate.mockImplementation(async () => [1]);
});

afterEach(() => {
  jest.clearAllMocks();
});

const checkPatientCreateeWith = ({
  newLinks,
  newLinksDemographicsHistory,
}: {
  newLinks: CQLink[];
  newLinksDemographicsHistory?: LinkDemographicsHistory;
}) => {
  expect(cqPatientModel_create).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({
        links: expect.objectContaining(newLinks),
        ...(newLinksDemographicsHistory && {
          linkDemographicsHistory: expect.objectContaining(newLinksDemographicsHistory),
        }),
      }),
    })
  );
};

const checkPatientUpdateWith = ({
  newLinks,
  newLinksDemographicsHistory,
}: {
  newLinks: CQLink[];
  newLinksDemographicsHistory?: LinkDemographicsHistory;
}) => {
  expect(cqPatientModel_update).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({
        links: expect.objectContaining(newLinks),
        ...(newLinksDemographicsHistory && {
          linkDemographicsHistory: expect.objectContaining(newLinksDemographicsHistory),
        }),
      }),
    }),
    expect.anything()
  );
};

describe("create or update cq data", () => {
  it("create patient data (links only)", async () => {
    const patient = makePatient();
    cqPatientModel_findOne.mockResolvedValueOnce(undefined);
    const newLinks = [makeCqDataLink()];
    await createOrUpdateCQPatientData({
      id: patient.id,
      cxId: patient.cxId,
      cqLinks: newLinks,
    });
    checkPatientCreateeWith({
      newLinks,
    });
  });
  it("create patient data (links and links demographics)", async () => {
    const patient = makePatient();
    cqPatientModel_findOne.mockResolvedValueOnce(undefined);
    const newLinks = [makeCqDataLink()];
    const newLinksDemographicsHistory = makeLinksHistory();
    const requestId = Object.keys(newLinksDemographicsHistory)[0];
    const linksDemographics = Object.values(newLinksDemographicsHistory)[0];
    await createOrUpdateCQPatientData({
      id: patient.id,
      cxId: patient.cxId,
      cqLinks: newLinks,
      requestLinksDemographics: {
        requestId,
        linksDemographics,
      },
    });
    checkPatientCreateeWith({
      newLinks,
      newLinksDemographicsHistory,
    });
  });
  it("update patient with existing initial link demographics (createOrUpdate)", async () => {
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
  it("update patient with existing initial link demographics (update)", async () => {
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
    await updateCQPatientData({
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
