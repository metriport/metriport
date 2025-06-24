import { Resource } from "@medplum/fhirtypes";
import { ResourceDimension, DimensionConfig } from "./resource-dimension";
import { ResourceNode } from "./resource-node";

export abstract class ResourceCluster<T extends Resource> {
  private resourceNodes: ResourceNode<T>[] = [];
  private resourceDimensions: ResourceDimension<T>[] = [];
  private resourceIdMap: Map<string, ResourceNode<T>> = new Map();

  constructor(private readonly resourceType: string) {
    this.resourceType = resourceType;
  }

  /**
   * Add a dimension to the cluster. Called in the constructor of the subclass
   * to configure one or more dimensions to separate inner resources along.
   * @param dimension - The dimension to add.
   */
  protected addDimension(dimension: DimensionConfig<T>) {
    this.resourceDimensions.push(new ResourceDimension(dimension));
  }

  public addResource(resource: T) {
    for (const dimension of this.resourceDimensions) {
      dimension.insertResource(resource);
    }
    if (this.hasResourceNode(resource)) {
      // this.resourceNodes.push(this.createResourceNode(resource));
    } else {
      const resourceNode = this.createResourceNode(resource);
      this.resourceNodes.push(resourceNode);
      if (resource.id) {
        this.resourceIdMap.set(resource.id, resourceNode);
      }
    }
  }

  protected createResourceNode(resource: T): ResourceNode<T> {
    return new ResourceNode(resource);
  }

  protected hasResourceNode(resource: T): boolean {
    if (!resource.id) return false;
    return this.resourceIdMap.has(resource.id);
  }

  protected abstract isEqual(resourceA: T, resourceB: T): boolean;

  public getResourceType(): string {
    return this.resourceType;
  }
}
