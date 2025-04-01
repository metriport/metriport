import { ResourceArray } from "@medplum/core";
import { Bundle, DocumentReference, Resource, ResourceType } from "@medplum/fhirtypes";
import { chunk } from "lodash";
import { Op } from "sequelize";
import { DocRefMappingModel } from "../../../models/medical/docref-mapping";

export interface FhirClient {
  readResource(resourceType: ResourceType, id: string): Promise<DocumentReference>;
  deleteResource(resourceType: Resource["resourceType"], resourceId: string): Promise<void>;
  updateResource(resource: Resource): Promise<DocumentReference>;
  searchResourcePages(resourceType: ResourceType, query: string): Promise<ResourceArray>;
  executeBatch(bundle: Bundle<Resource>): Promise<void>;
}

type GetDocRefMappingResult = DocRefMappingModel & {
  organization: {
    id: string;
    name: string;
  };
};

export class PostgresFhirClient implements FhirClient {
  private readonly cxId: string;
  /**
   * Creates a new FHIR client configured to access a specific tenant's data.
   *
   * @param tenantId the customer ID, used to determine the tenant on HAPI (data isolation per cx)
   * @param baseUrl the base URL of the server, don't send `undefined` otherwise it'll point to Medplum's server
   */
  constructor(cxId: string) {
    this.cxId = cxId;
  }

  async readResource(resourceType: ResourceType, id: string): Promise<DocumentReference> {
    if (resourceType !== "DocumentReference") {
      throw new Error("Resource type not supported");
    }

    const docRef = (await DocRefMappingModel.findOne({
      where: { id, cxId: this.cxId },
    })) as GetDocRefMappingResult | null;
    if (!docRef) {
      throw new Error("DocRef not found");
    }

    return JSON.parse(docRef.rawResource) as DocumentReference;
  }

  async deleteResource(resourceType: Resource["resourceType"], resourceId: string): Promise<void> {
    if (resourceType !== "DocumentReference") {
      throw new Error("Resource type not supported");
    }

    await DocRefMappingModel.destroy({ where: { id: resourceId, cxId: this.cxId } });

    return;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async updateResource(resource: Resource): Promise<DocumentReference> {
    if (resource.resourceType !== "DocumentReference") {
      throw new Error("Resource type not supported");
    }

    const docRef = resource as DocumentReference;

    await DocRefMappingModel.update(
      { rawResource: JSON.stringify(docRef) },
      { where: { id: docRef.id, cxId: this.cxId } }
    );

    return docRef;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async searchResourcePages(resourceType: ResourceType, query: string): Promise<ResourceArray> {
    throw new Error("Not implemented");
  }

  async executeBatch(bundle: Bundle): Promise<void> {
    if (bundle.type === "transaction") {
      throw new Error("Bundle type not supported");
    }

    const docRefs =
      bundle.entry?.filter(entry => entry.resource?.resourceType === "DocumentReference") ?? [];

    const deletions = docRefs.filter(entry => entry.request?.method === "DELETE");
    const updates = docRefs.filter(entry => entry.request?.method === "PUT");

    chunk(deletions, 500).forEach(async chunk => {
      const ids = chunk.map(entry => entry.resource?.id).filter(Boolean) as string[];

      await DocRefMappingModel.destroy({
        where: {
          cxId: this.cxId,
          id: { [Op.in]: ids },
        },
      });
    });

    chunk(updates, 100).forEach(async chunk => {
      const resourceIds = chunk.map(dr => {
        if (!dr.resource?.id) {
          throw new Error("Resource ID is required");
        }
        return dr.resource.id;
      });

      const cases = chunk
        .map(dr => {
          const jsonString = JSON.stringify(dr.resource).replace(/'/g, "''");
          return `WHEN id = '${dr.resource?.id}' THEN '${jsonString}'::jsonb`;
        })
        .join("\n        ");

      return DocRefMappingModel.sequelize?.query(
        `UPDATE doc_ref_mapping 
           SET raw_resource = CASE
             ${cases}
           END
           WHERE id = ANY($1) AND cx_id = $2;`,
        {
          bind: [resourceIds, this.cxId],
        }
      );
    });
  }
}
