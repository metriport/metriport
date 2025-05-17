import { Resource } from "@medplum/fhirtypes";

export const defaultHasMinimumData = false;

/**
 * Interface for converting FHIR resources to string representation
 */
export interface FHIRResourceToString<T extends Resource> {
  /**
   * Converts a FHIR resource to its string representation
   * @param resource - The FHIR resource to convert
   * @returns The string representation of the resource
   */
  toString(resource: T): string | undefined;
}
