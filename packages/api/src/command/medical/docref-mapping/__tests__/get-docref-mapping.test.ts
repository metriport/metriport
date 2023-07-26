/* eslint-disable @typescript-eslint/no-empty-function */
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.test" });
// Keep dotenv import and config before everything else
import { DocRefMappingCreate } from "../../../../domain/medical/docref-mapping";
import { MedicalDataSource } from "../../../../external";
import { makeDocRefMappingModel } from "../../../../models/medical/__tests__/docref-mapping";
import { DocRefMappingModel } from "../../../../models/medical/docref-mapping";
import { uuidv7 } from "../../../../shared/uuid-v7";
import * as createDocRefMappingModule from "../create-docref-mapping";
import { getOrCreateDocRefMapping } from "../get-docref-mapping";

let docRefModel_findOne: jest.SpyInstance;
let createDocumentReference_mock: jest.SpyInstance;
let docRefBase: DocRefMappingCreate;
let docRefModel: DocRefMappingModel;

beforeEach(() => {
  docRefBase = {
    cxId: uuidv7(),
    patientId: uuidv7(),
    externalId: uuidv7(),
    source: MedicalDataSource.COMMONWELL,
  };
  docRefModel = makeDocRefMappingModel(docRefBase);
  docRefModel_findOne = jest
    .spyOn(DocRefMappingModel, "findOne")
    .mockImplementation(async () => docRefModel);
  createDocumentReference_mock = jest
    .spyOn(createDocRefMappingModule, "createDocRefMapping")
    .mockResolvedValue(docRefModel);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("getOrCreateDocumentReference", () => {
  it("returns existing doc ref", async () => {
    const res = await getOrCreateDocRefMapping(docRefBase);
    expect(docRefModel_findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        where: docRefBase,
      })
    );
    expect(createDocumentReference_mock).not.toHaveBeenCalled();
    expect(res).toEqual(docRefModel);
  });
  it("creates one when not found", async () => {
    docRefModel_findOne.mockResolvedValueOnce(undefined);
    const res = await getOrCreateDocRefMapping(docRefBase);
    expect(docRefModel_findOne).toHaveBeenCalled();
    expect(createDocumentReference_mock).toHaveBeenCalledWith(expect.objectContaining(docRefBase));
    expect(res).toEqual(docRefModel);
  });
});
