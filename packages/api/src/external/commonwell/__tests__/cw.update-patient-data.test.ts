/* eslint-disable @typescript-eslint/no-empty-function */
import { CwPatientDataModel } from "../models/cw-patient-data";
import { LinkDemographicsHistory } from "@metriport/core/domain/patient-demographics";
import { makeCwDataLink, makeLinksHistory, makeCwPatientData } from "./cw-patient-data";
import { makePatient } from "../../../domain/medical/__tests__/patient";
import { mockStartTransaction } from "../../../models/__tests__/transaction";
import { CwLink } from "../cw-patient-data";
import { createOrUpdateCwPatientData } from "../command/cw-patient-data/create-cw-data";
import { updateCwPatientData } from "../command/cw-patient-data/update-cw-data";

let cwPatientModel_findOne: jest.SpyInstance;
let cwPatientModel_create: jest.SpyInstance;
let cwPatientModel_update: jest.SpyInstance;

const mockUpdate = jest.fn();

beforeEach(() => {
  mockStartTransaction();
  cwPatientModel_findOne = jest.spyOn(CwPatientDataModel, "findOne");
  cwPatientModel_create = jest
    .spyOn(CwPatientDataModel, "create")
    .mockImplementation(async () => [1]);
  cwPatientModel_update = mockUpdate.mockImplementation(async () => [1]);
});

afterEach(() => {
  jest.clearAllMocks();
});

const checkPatientCreateeWith = ({
  newLinks,
  newLinksDemographicsHistory,
}: {
  newLinks: CwLink[];
  newLinksDemographicsHistory?: LinkDemographicsHistory;
}) => {
  expect(cwPatientModel_create).toHaveBeenCalledWith(
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
  newLinks: CwLink[];
  newLinksDemographicsHistory: LinkDemographicsHistory;
}) => {
  expect(cwPatientModel_update).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({
        links: expect.objectContaining(newLinks),
        linkDemographicsHistory: expect.objectContaining(newLinksDemographicsHistory),
      }),
    }),
    expect.anything()
  );
};

describe("create or update cw data", () => {
  it("create patient data (links only)", async () => {
    const patient = makePatient();
    cwPatientModel_findOne.mockResolvedValueOnce(undefined);
    const newLinks = [makeCwDataLink()];
    await createOrUpdateCwPatientData({
      id: patient.id,
      cxId: patient.cxId,
      cwLinks: newLinks,
    });
    checkPatientCreateeWith({
      newLinks,
    });
  });
  it("create patient data (links and links demographics)", async () => {
    const patient = makePatient();
    cwPatientModel_findOne.mockResolvedValueOnce(undefined);
    const newLinks = [makeCwDataLink()];
    const newLinksDemographicsHistory = makeLinksHistory();
    const requestId = Object.keys(newLinksDemographicsHistory)[0];
    const linksDemographics = Object.values(newLinksDemographicsHistory)[0];
    await createOrUpdateCwPatientData({
      id: patient.id,
      cxId: patient.cxId,
      cwLinks: newLinks,
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
    const existingCwLinks = [makeCwDataLink()];
    const existingLinksDemographicsHistory = makeLinksHistory();
    const cwPatientData = makeCwPatientData({
      data: {
        links: existingCwLinks,
        linkDemographicsHistory: existingLinksDemographicsHistory,
      },
    });
    cwPatientModel_findOne.mockResolvedValueOnce({
      ...cwPatientData,
      update: mockUpdate,
    });
    const newLinks = [makeCwDataLink()];
    const newLinksDemographicsHistory = makeLinksHistory();
    const requestId = Object.keys(newLinksDemographicsHistory)[0];
    const linksDemographics = Object.values(newLinksDemographicsHistory)[0];
    await createOrUpdateCwPatientData({
      id: cwPatientData.id,
      cxId: cwPatientData.cxId,
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
  it("update patient with existing initial link demographics (update)", async () => {
    const existingCwLinks = [makeCwDataLink()];
    const existingLinksDemographicsHistory = makeLinksHistory();
    const cwPatientData = makeCwPatientData({
      data: {
        links: existingCwLinks,
        linkDemographicsHistory: existingLinksDemographicsHistory,
      },
    });
    cwPatientModel_findOne.mockResolvedValueOnce({
      ...cwPatientData,
      update: mockUpdate,
    });
    const newLinks = [makeCwDataLink()];
    const newLinksDemographicsHistory = makeLinksHistory();
    const requestId = Object.keys(newLinksDemographicsHistory)[0];
    const linksDemographics = Object.values(newLinksDemographicsHistory)[0];
    await updateCwPatientData({
      id: cwPatientData.id,
      cxId: cwPatientData.cxId,
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
