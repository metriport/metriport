import { Bundle, Resource } from "@medplum/fhirtypes";

/**
 * Converts a bundle into a NDJSON string - New line Delimited JSON.
 * Thats essentially text file with a JSON string from each resource per line.
 *
 * This is used convert existing FHIR bundles into a string that can be saved to a file
 * and later on used to import data on FHIR servers.
 *
 * @see https://build.fhir.org/ig/HL7/bulk-data/export.html for info on how to obtain a data export
 * from a FHIR server.
 */
export function bundleToNdjson(bundle: Bundle<Resource>): string {
  return (
    bundle.entry
      ?.map(entry => {
        return JSON.stringify(entry.resource);
      })
      .join("\n") ?? ""
  );
}
