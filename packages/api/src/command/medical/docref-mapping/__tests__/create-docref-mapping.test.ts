/* eslint-disable @typescript-eslint/no-empty-function */
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.test" });
// Keep dotenv import and config before everything else
import { DocRefMappingCreate } from "../../../../domain/medical/docref-mapping";
import { MedicalDataSource } from "../../../../external";
import { makeDocRefMappingModel } from "../../../../models/medical/__tests__/docref-mapping";
import { DocRefMappingModel } from "../../../../models/medical/docref-mapping";
import { uuidv7 } from "../../../../shared/uuid-v7";
import { externalDocRefIds } from "../../__tests__/external-ids";
import { createDocRefMapping } from "../create-docref-mapping";

let docRefModel_create: jest.SpyInstance;
let docRefCreate: DocRefMappingCreate;

beforeEach(() => {
  docRefModel_create = jest
    .spyOn(DocRefMappingModel, "create")
    .mockImplementation(async docRefCreate => makeDocRefMappingModel(docRefCreate));
  docRefCreate = {
    cxId: uuidv7(),
    patientId: uuidv7(),
    externalId: uuidv7(),
    source: MedicalDataSource.COMMONWELL,
  };
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("createDocRefMapping", () => {
  it("sends doc ref to repo", async () => {
    await createDocRefMapping(docRefCreate);
    expect(docRefModel_create).toHaveBeenCalledWith(expect.objectContaining(docRefCreate));
  });
  it("returns result of creating at repo", async () => {
    const res = await createDocRefMapping(docRefCreate);
    expect(res).toBeTruthy();
    expect(res).toEqual(expect.objectContaining(docRefCreate));
  });
  it("sets doc ref ID", async () => {
    const res = await createDocRefMapping(docRefCreate);
    expect(res).toBeTruthy();
    expect(res.id).toBeTruthy();
  });
  describe("accepts external IDs", () => {
    for (const externalId of externalDocRefIds) {
      it(`creates docRef with external id ${externalId}`, async () => {
        const localDocRefCreate = {
          ...docRefCreate,
          externalId,
        };
        const res = await createDocRefMapping(localDocRefCreate);
        expect(docRefModel_create).toHaveBeenCalledWith(expect.objectContaining(localDocRefCreate));
        expect(res).toEqual(expect.objectContaining(localDocRefCreate));
      });
    }
  });
});
