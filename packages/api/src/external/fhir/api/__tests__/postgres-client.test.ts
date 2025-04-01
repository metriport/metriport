import { mockStartTransaction } from "../../../../models/__tests__/transaction";
import { DocRefMappingModel } from "../../../../models/medical/docref-mapping";
import { makeFhirApi } from "../postgres-api-factory";
import { FhirClient } from "../postgres-client";

let docRefMappingModel_findOne: jest.SpyInstance;
let docRefMappingModel_destroy: jest.SpyInstance;
let docRefMappingModel_query: jest.SpyInstance;
let fhirApi: FhirClient;

beforeEach(() => {
  mockStartTransaction();
  docRefMappingModel_findOne = jest.spyOn(DocRefMappingModel, "findOne");
  docRefMappingModel_destroy = jest.spyOn(DocRefMappingModel, "destroy");
  docRefMappingModel_query = DocRefMappingModel.sequelize
    ? jest.spyOn(DocRefMappingModel.sequelize, "query")
    : jest.fn();
  fhirApi = makeFhirApi("cx-id");
});

describe("Postgres Fhir Client Tests", () => {
  //   it("Reads a DocumentReference from Postgres and returns it in FHIR format", async () => {
  //     const res = await DocRefMappingModel.findOne({
  //       where: { id: "01910a61-444a-715c-94ce-e8bd438da6d7" },
  //     });
  //     console.log("======", res);
  //   });
  // });
  it("Reads a DocumentReference from Postgres and returns it in FHIR format", async () => {
    docRefMappingModel_findOne.mockResolvedValueOnce(
      Promise.resolve({
        id: "doc-uuid",
        cxId: "test-cx-id",
        patientId: "test-patient-id",
        source: "test-source",
        externalId: "test-external-id",
        requestId: "test-request-id",
        rawResource: '{ "id": "doc-uuid" }',
      })
    );

    const result = await fhirApi.readResource("DocumentReference", "doc-uuid");

    expect(docRefMappingModel_findOne).toHaveBeenCalledWith({
      where: {
        id: "doc-uuid",
        cxId: "cx-id",
      },
    });

    expect(result.id).toEqual("doc-uuid");
  });

  it("Reads a DocumentReference from Postgres and returns it in FHIR format", async () => {
    docRefMappingModel_destroy.mockResolvedValueOnce(Promise.resolve(1));

    await fhirApi.deleteResource("DocumentReference", "doc-uuid");

    expect(docRefMappingModel_destroy).toHaveBeenCalledWith({
      where: {
        id: "doc-uuid",
        cxId: "cx-id",
      },
    });
  });

  it("executeBatch properly formats the JSON string", async () => {
    docRefMappingModel_query.mockResolvedValueOnce(undefined);

    const bundle: Bundle<Resource> = {
      resourceType: "Bundle",
      type: "batch",
      entry: [
        {
          resource: {
            resourceType: "DocumentReference",
            id: "00000000-0000-0000-0000-000000000000",
          },
          request: {
            method: "PUT",
          },
        },
      ],
    };

    await fhirApi.executeBatch(bundle);

    expect(docRefMappingModel_query).toHaveBeenCalledWith(
      `UPDATE doc_ref_mapping
           SET raw_resource = CASE
            WHEN id = '00000000-0000-0000-0000-000000000000' THEN '${JSON.stringify(bundle)}'::jsonb
           END
           WHERE id = ANY($1) AND cx_id = $2;`
    );
  });
});
