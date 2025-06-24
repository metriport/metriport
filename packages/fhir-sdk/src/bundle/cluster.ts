import { Bundle, Resource } from "@medplum/fhirtypes";
import { ResourceCluster } from "./resource-cluster";

import { resourceClusterClass } from "../resource/cluster";

type AnyClass = new (...args: unknown[]) => ResourceCluster<Resource>;

export class BundleCluster {
  private resourceCluster: Map<string, ResourceCluster<Resource>> = new Map();

  public addResource(resource: Resource): void {
    const resourceType = resource.resourceType;
    if (!resourceType) return;
    const cluster = this.getResourceCluster(resourceType);
    cluster.addResource(resource);
  }

  /**
   * Get the merge tree for a given resource type.
   * @param resourceType - The FHIR resource type to get the merge tree for.
   * @returns the corresponding ResourceMergeTree
   */
  private getResourceCluster(resourceType: string): ResourceCluster<Resource> {
    const existingCluster = this.resourceCluster.get(resourceType);
    if (existingCluster) return existingCluster;

    const clusterClass = resourceClusterClass[resourceType] as AnyClass;
    if (!clusterClass) {
      throw new Error(`No merge tree class found for resource type: ${resourceType}`);
    }
    const cluster = new clusterClass(resourceType);
    this.resourceCluster.set(resourceType, cluster);
    return cluster;
  }

  getBundle(): Bundle {
    const bundle: Bundle = {
      resourceType: "Bundle",
      type: "collection",
      entry: [],
    };
    return bundle;
  }
}
