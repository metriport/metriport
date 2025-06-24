import { Resource } from "@medplum/fhirtypes";

/**
 * A resource node refers to a collection of resources that are considered equivalent.
 */
export class ResourceNode<T extends Resource> {
  // Duplicates are "center" nodes which aggregate on a resource node
  private master: T;
  private duplicates: T[] | undefined;

  constructor(resource: T) {
    this.master = resource;
  }

  public recursivelyMerge(resource: T): ResourceNode<T> {
    if (this.master.id === resource.id) {
      this.addDuplicate(resource);
    }
    return this;
  }

  private addDuplicate(resource: T): void {
    if (!this.duplicates) {
      this.duplicates = [resource];
    } else {
      this.duplicates.push(resource);
    }
  }
}
