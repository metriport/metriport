import { Bundle, Resource } from "@medplum/fhirtypes";

export interface SearchSetBundle<T extends Resource = Resource> extends Omit<Bundle<T>, "type"> {
  type: "searchset";
}
