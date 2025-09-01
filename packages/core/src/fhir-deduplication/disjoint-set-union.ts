import { Resource } from "@medplum/fhirtypes";
import { Comparator } from "lodash";

/**
 * Disjoint Set Union (DSU) is a data structure that keeps track of a set of elements partitioned into a number of disjoint (non-overlapping) subsets,
 * which are referred to in this implementation as "groups".
 */
export class DisjointSetUnion<R extends Resource> {
  private resources: R[];
  private groupId: number[];

  /**
   * Every resource is initialized with its own index as its group ID.
   * @param resources - The FHIR resources to initialize the DSU with
   */
  constructor(resources: R[]) {
    this.resources = resources;
    this.groupId = new Array(resources.length);
    for (let i = 0; i < resources.length; i++) {
      this.groupId[i] = i;
    }
  }

  /**
   * Performs deduplication on the given resources using the given set of equality comparators.
   * @param comparators
   */
  deduplicate(comparators: Comparator<R>[]) {
    for (let i = 0; i < this.groupId.length; i++) {
      for (let j = i + 1; j < this.groupId.length; j++) {
        const resourceI = this.resources[i];
        const resourceJ = this.resources[j];
        if (!resourceI || !resourceJ) continue;
        const equal = comparators.some(comparator => comparator(resourceI, resourceJ));
        if (equal) {
          this.unionGroup(i, j);
        }
      }
    }
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
