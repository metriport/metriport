import { Resource } from "@medplum/fhirtypes";

export const defaultHasMinimumData = false;

/**
 * Interface for converting FHIR resources to string representation
 */
export interface FHIRResourceToString<T extends Resource> {
  /**
   * Converts a FHIR resource to its string representation
   * @param resource - The FHIR resource to convert
   * @param isDebug - Whether to include debug information in the output, like the property "label"
   * @returns The string representation of the resource
   */
  toString(resource: T, isDebug?: boolean): string | undefined;
}
