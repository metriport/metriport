import { Resource, ResourceType } from "@medplum/fhirtypes";
import { Comparator } from "lodash";

// Generates a hash key from the resource - undefined keys are ignored.
export type HashKeyGenerator<R extends Resource> = (resource: R) => string | undefined;

// Merges multiple resources into a single resource, and guaranteed to have at least one resource
export type MergeFunction<R extends Resource> = (resources: R[]) => R;

export type DeduplicationResult<R extends Resource> = {
  resourceMap: Map<string, R>;
  refReplacementMap: Map<string, string>;
  danglingReferences: Set<string>;
};

interface DisjointSetUnionParams<R extends Resource> {
  resourceType: ResourceType;
  resources: R[];
  comparators?: Comparator<R>[];
  hashKeyGenerators?: HashKeyGenerator<R>[];
  merge: MergeFunction<R>;
}

/**
 * Disjoint Set Union (DSU) is a data structure that keeps track of a set of elements partitioned into a number of disjoint (non-overlapping) subsets,
 * which are referred to in this implementation as "groups".
 */
export class DisjointSetUnion<R extends Resource> {
  private resourceType: ResourceType;
  private resources: R[];
  private comparators: Comparator<R>[];
  private hashKeyGenerators: HashKeyGenerator<R>[];
  private merge: MergeFunction<R>;
  private groupId: number[];

  /**
   * Every resource is initialized with its own index as its group ID.
   * @param resources - The FHIR resources to initialize the DSU with
   */
  constructor({
    resourceType,
    resources,
    comparators = [],
    hashKeyGenerators = [],
    merge,
  }: DisjointSetUnionParams<R>) {
    this.resourceType = resourceType;
    this.resources = resources;
    this.comparators = comparators;
    this.hashKeyGenerators = hashKeyGenerators;
    this.merge = merge;

    // Initialize a disjoint set for each resource.
    this.groupId = new Array(resources.length);
    for (let i = 0; i < resources.length; i++) {
      this.groupId[i] = i;
    }
  }

  /**
   * Performs deduplication on the given resources using the given set of hash key generators and equality comparators.
   * To improve performance, comparators that are more likely to produce equality should be ordered *before* equality
   * comparators that are less likely to produce equality.
   */
  deduplicate(): DeduplicationResult<R> {
    // Ensure that duplicate resources are merged by resource ID first.
    this.mergeGroupsByResourceId();
    // First deduplicate in O(n) by hash keys, to avoid unnecessary comparisons.
    for (const hashKeyGenerator of this.hashKeyGenerators) {
      this.mergeGroupsByHashKey(hashKeyGenerator);
    }
    // Then deduplicate in O(n^2) by equality comparators.
    for (const comparator of this.comparators) {
      this.mergeGroupsByComparator(comparator);
    }
    // Finally, group resources in O(n) to generate the final deduplication result.
    const groupResources = this.splitResourcesByGroup();
    return this.createResourceMap(groupResources);
  }

  /**
   * Ensures that resources with the same ID are always joined into the same group.
   */
  private mergeGroupsByResourceId() {
    const resourceGroup: Record<string, number> = {};
    for (let i = 0; i < this.resources.length; i++) {
      const resource = this.resources[i];
      if (!resource || !resource.id) continue;

      const existingGroupId = resourceGroup[resource.id];
      const groupId = this.findGroup(i);
      if (existingGroupId !== undefined) {
        this.unionGroup(existingGroupId, groupId);
      } else {
        resourceGroup[resource.id] = groupId;
      }
    }
  }

  /**
   * Deduplicates the resources by the given hash key generator.
   * @param hashKeyGenerator - Function that generates a hash key from the resource
   */
  private mergeGroupsByHashKey(hashKeyGenerator: HashKeyGenerator<R>) {
    const hashKeyMap: Record<string, number> = {};

    for (let i = 0; i < this.resources.length; i++) {
      const resource = this.resources[i];
      if (!resource) continue;
      const groupId = this.findGroup(i);

      const hashKey = hashKeyGenerator(resource);
      if (hashKey !== undefined) {
        const existingGroupId = hashKeyMap[hashKey];
        if (existingGroupId !== undefined) {
          this.unionGroup(existingGroupId, groupId);
        } else {
          hashKeyMap[hashKey] = groupId;
        }
      }
    }
  }

  /**
   * Merge all groups where the comparator returns true for a comparison between two resources of that group.
   * @param comparator - Function that compares two resources and returns true if they are equal
   */
  private mergeGroupsByComparator(comparator: Comparator<R>) {
    for (let i = 0; i < this.groupId.length; i++) {
      for (let j = i + 1; j < this.groupId.length; j++) {
        const resourceI = this.resources[i];
        const resourceJ = this.resources[j];
        if (!resourceI || !resourceJ) continue;

        // Skip if the resources are already in the same group
        const groupOfResourceI = this.findGroup(i);
        const groupOfResourceJ = this.findGroup(j);
        if (groupOfResourceI === groupOfResourceJ) continue;

        // Join groups if the comparator returns true for a comparison between the two resources
        const equal = comparator(resourceI, resourceJ);
        if (equal) {
          this.unionGroup(i, j);
        }
      }
    }
  }

  /**
   * Splits the initial resource array into subarrays based on group IDs. All resources in a group array
   * are considered to be duplicates of each other.
   * @returns A map of group IDs to arrays of resources.
   */
  private splitResourcesByGroup(): Map<number, R[]> {
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

  /**
   * Builds the final deduplication result that plugs into the rest of the deduplication algorithm.
   * @param groupResources - The result of separateResourcesByGroup.
   */
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
  private findGroup(index: number): number {
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
  private unionGroup(x: number, y: number) {
    const parentX = this.findGroup(x);
    const parentY = this.findGroup(y);
    if (parentX !== parentY) {
      this.groupId[parentY] = parentX;
    }
  }
}
