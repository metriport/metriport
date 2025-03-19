import { Resource } from "@medplum/fhirtypes";
/**
 * Checks if a resource should be filtered out based on text content
 * Filters out resources containing "elation" or "Form Health" (case-insensitive)
 */
export const shouldFilterResource = (resource: Resource): boolean => {
  if (!resource) return false;

  // Convert the entire resource to a string for searching
  const resourceString = JSON.stringify(resource).toLowerCase();

  // Check for filtered terms - match "elation" at word start but allow it to be part of a word
  return /\belation/.test(resourceString) || resourceString.includes("form health");
};
