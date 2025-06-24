import { Composition } from "@medplum/fhirtypes";
import { DOC_ID_EXTENSION_URL } from "../../constants";
import { ResourceCluster } from "../../bundle/resource-cluster";
import { CompositionResourceNode } from "./node";

export class CompositionCluster extends ResourceCluster<Composition> {
  constructor() {
    super("Composition");
    this.addDimension({
      type: "string",
      name: "documentName",
      getter(resource) {
        return resource.extension?.find(ext => ext.url === DOC_ID_EXTENSION_URL)?.valueString;
      },
    });
  }

  protected override createResourceNode(resource: Composition): CompositionResourceNode {
    return new CompositionResourceNode(resource);
  }

  protected override isEqual(resourceA: Composition, resourceB: Composition): boolean {
    return resourceA.id === resourceB.id;
  }

  public deduplicateReferences(resource: Composition): void {
    const uniqueAuthors = new Set();
    if (resource.author) {
      resource.author = resource.author.filter(author => {
        if (uniqueAuthors.has(author.reference)) return false;
        uniqueAuthors.add(author.reference);
        return true;
      });
    }
    if (resource.section) {
      resource.section = resource.section.map(section => {
        if (section.entry) {
          const uniqueEntries = new Set();
          section.entry = section.entry.filter(item => {
            if (uniqueEntries.has(item.reference)) return false;
            uniqueEntries.add(item.reference);
            return true;
          });
        }
        return section;
      });
    }
  }
}
