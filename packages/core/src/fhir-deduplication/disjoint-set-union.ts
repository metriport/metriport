import { Resource, ResourceType } from "@medplum/fhirtypes";
import { Comparator } from "lodash";

// Merges multiple resources into a single resource, and guaranteed to have at least one resource
export type MergeFunction<R extends Resource> = (resources: R[]) => R;

export type DeduplicationResult<R extends Resource> = {
  resourceMap: Map<string, R>;
  refReplacementMap: Map<string, string>;
  danglingReferences: Set<string>;
};

/**
 * Disjoint Set Union (DSU) is a data structure that keeps track of a set of elements partitioned into a number of disjoint (non-overlapping) subsets,
 * which are referred to in this implementation as "groups".
 */
export class DisjointSetUnion<R extends Resource> {
  private resourceType: ResourceType;
  private resources: R[];
  private comparators: Comparator<R>[];
  private merge: MergeFunction<R>;
  private groupId: number[];

  /**
   * Every resource is initialized with its own index as its group ID.
   * @param resources - The FHIR resources to initialize the DSU with
   */
  constructor({
    resourceType,
    resources,
    comparators,
    merge,
  }: {
    resourceType: ResourceType;
    resources: R[];
    comparators: Comparator<R>[];
    merge: MergeFunction<R>;
  }) {
    this.resourceType = resourceType;
    this.resources = resources;
    this.comparators = comparators;
    this.merge = merge;
    this.groupId = new Array(resources.length);
    for (let i = 0; i < resources.length; i++) {
      this.groupId[i] = i;
    }
  }

  /**
   * Performs deduplication on the given resources using the given set of equality comparators.
   * @param comparators
   */
  deduplicate(): DeduplicationResult<R> {
    this.compareAndMergeAllGroups();
    const groupResources = this.separateResourcesByGroup();
    return this.createResourceMap(groupResources);
  }

  private compareAndMergeAllGroups() {
    for (let i = 0; i < this.groupId.length; i++) {
      for (let j = i + 1; j < this.groupId.length; j++) {
        const resourceI = this.resources[i];
        const resourceJ = this.resources[j];
        if (!resourceI || !resourceJ) continue;
        const equal = this.comparators.some(comparator => comparator(resourceI, resourceJ));
        if (equal) {
          this.unionGroup(i, j);
        }
      }
    }
  }

  private separateResourcesByGroup(): Map<number, R[]> {
    const resourcesForGroup: Map<number, R[]> = new Map();
    for (let i = 0; i < this.groupId.length; i++) {
      const groupId = this.findGroup(i);
      const resource = this.resources[i];
      if (!resource) continue;

      if (!resourcesForGroup.has(groupId)) {
        resourcesForGroup.set(groupId, [resource]);
      } else {
        resourcesForGroup.get(groupId)?.push(resource);
      }
    }
    return resourcesForGroup;
  }

  private createResourceMap(groupResources: Map<number, R[]>): DeduplicationResult<R> {
    const resourceMap: Map<string, R> = new Map();
    const refReplacementMap: Map<string, string> = new Map();
    const danglingReferences: Set<string> = new Set();

    for (const [, resourcesInGroup] of groupResources.entries()) {
      if (resourcesInGroup.length === 0) continue;
      const mergedResource = this.merge(resourcesInGroup);
      const mergedResourceId = mergedResource.id;
      if (!mergedResourceId) continue;

      for (const resource of resourcesInGroup) {
        const replaceResourceId = resource.id;
        if (!replaceResourceId) continue;
        refReplacementMap.set(this.createRef(replaceResourceId), this.createRef(mergedResourceId));
      }
      resourceMap.set(mergedResourceId, mergedResource);
    }
    return { resourceMap, refReplacementMap, danglingReferences };
  }

  private createRef(id: string): string {
    return `${this.resourceType}/${id}`;
  }

  /**
   * Returns the group ID for the given index.
   * @param index - The index to get the group ID for
   * @returns The root group ID for the given index, or -1 if the index is invalid
   */
  findGroup(index: number): number {
    const groupIdAtIndex = this.groupId[index];
    if (groupIdAtIndex === undefined) return -1;
    // If this is a root node with no reference to another index as a parent
    if (groupIdAtIndex === index) {
      return groupIdAtIndex;
    }
    // If this is a child node with a reference to another index as a parent,
    // return the root ID and collapse any intermediate references to parent IDs.
    else {
      const rootGroupId = this.findGroup(groupIdAtIndex);
      this.groupId[index] = rootGroupId;
      return rootGroupId;
    }
  }

  /**
   * Joins the resources at the given indices into the same group.
   * @param x - The index of the first resource to join
   * @param y - The index of the second resource to join
   */
  unionGroup(x: number, y: number) {
    const parentX = this.findGroup(x);
    const parentY = this.findGroup(y);
    if (parentX !== parentY) {
      this.groupId[parentY] = parentX;
    }
  }
}
