/* eslint-disable @typescript-eslint/no-empty-function */
import { DocRefMappingCreate } from "../../../../domain/medical/docref-mapping";
import { MedicalDataSource } from "@metriport/core/external/index";
import { makeDocRefMappingModel } from "../../../../models/medical/__tests__/docref-mapping";
import { DocRefMappingModel } from "../../../../models/medical/docref-mapping";
import { uuidv7 } from "@metriport/core/util/uuid-v7";
import { externalDocRefIds } from "../../__tests__/external-ids";
import { getOrCreateDocRefMapping } from "../get-docref-mapping";

let docRefModel_findOrCreate: jest.SpyInstance;
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
  docRefModel_findOrCreate = jest.spyOn(DocRefMappingModel, "findOrCreate");
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("getOrCreateDocumentReference", () => {
  it("calls findOrCreate with docRefMapping data", async () => {
    docRefModel_findOrCreate.mockResolvedValueOnce([docRefModel, false]);
    await getOrCreateDocRefMapping(docRefBase);
    expect(docRefModel_findOrCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: docRefBase,
      })
    );
  });
  it("returns existing doc ref", async () => {
    docRefModel_findOrCreate.mockResolvedValueOnce([docRefModel, false]);
    const res = await getOrCreateDocRefMapping(docRefBase);
    expect(res).toEqual(docRefModel);
  });
  describe("accepts external IDs", () => {
    for (const externalId of externalDocRefIds) {
      it(`creates docRef with external id ${externalId}`, async () => {
        const localDocRefCreate = {
          ...docRefBase,
          externalId,
        };
        const docRefModelLocal = makeDocRefMappingModel(docRefBase);
        docRefModel_findOrCreate.mockResolvedValue([docRefModelLocal, false]);
        const res = await getOrCreateDocRefMapping(localDocRefCreate);
        expect(res).toEqual(expect.objectContaining(docRefModelLocal));
      });
    }
  });
});
