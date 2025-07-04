import { Bundle, Resource } from "@medplum/fhirtypes";
import { replaceBundleEntries } from "./bundle";

/**
 * Removes resources from the bundle.
 *
 * @param bundle - The bundle to remove resources from.
 * @param shouldRemove - A function that returns true if the resource should be removed.
 * @returns The updated bundle. Not a deep clone!
 */
export function removeResources({
  bundle,
  shouldRemove,
}: {
  bundle: Bundle;
  shouldRemove: (resource: Resource) => boolean;
}): Bundle {
  if (!bundle.entry) return bundle;

  const updatedEntry = bundle.entry.filter(entry => {
    const resource = entry.resource;
    if (!resource || !shouldRemove(resource)) {
      return true;
    }
    return false;
  });

  return replaceBundleEntries(bundle, updatedEntry);
}

/**
 * Removes resources from the contained array of each Resource in a Bundle.
 *
 * @param bundle - The bundle to remove contained resources from.
 * @param shouldRemove - A function that returns true if the contained resource should be removed.
 * @returns The updated bundle. Not a deep clone!
 */
export function removeContainedResources({
  bundle,
  shouldRemove,
}: {
  bundle: Bundle;
  shouldRemove: (resource: Resource) => boolean;
}): Bundle {
  if (!bundle.entry) return bundle;

  const updatedEntry = bundle.entry.map(entry => {
    const resource = entry.resource;
    if (resource && "contained" in resource) {
      return {
        ...entry,
        resource: {
          ...resource,
          contained: resource.contained?.filter(r => !shouldRemove(r)),
        },
      };
    }
    return entry;
  });

  return replaceBundleEntries(bundle, updatedEntry);
}
