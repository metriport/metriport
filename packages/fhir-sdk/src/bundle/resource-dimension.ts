import { Resource } from "@medplum/fhirtypes";

// type ResourceWithKey<T extends Resource, K extends keyof T> = T & Required<Pick<T, K>>;

export interface DimensionConfig<T extends Resource> {
  type: "string" | "number" | "date" | "datetime" | "boolean";
  name: string;
  getter: (resource: T) => string | undefined;
}

export class ResourceDimension<T extends Resource> {
  constructor(private readonly config: DimensionConfig<T>) {}

  public insertResource(resource: T) {
    this.config.getter(resource);
  }
}
