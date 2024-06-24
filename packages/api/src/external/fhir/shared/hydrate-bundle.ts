import { Extension, Organization, Reference, Resource } from "@medplum/fhirtypes";
import { Patient } from "@metriport/core/domain/patient";
import { toFHIR as toFhirPatient } from "@metriport/core/external/fhir/patient/index";
import { metriportDataSourceExtension } from "@metriport/core/external/fhir/shared/extensions/metriport";
import { isValidUuid, uuidv7 } from "@metriport/core/util/uuid-v7";
import { BadRequestError } from "@metriport/shared";
import { Bundle as ValidBundle } from "../../../routes/medical/schemas/fhir";

/**
 * Adds the Metriport and Document extensions to all the provided resources, ensures that all resources have UUIDs for IDs,
 * and adds the Patient and Organization resources to the Bundle
 */
export function hydrateBundle(
  bundle: ValidBundle,
  patient: Patient,
  org: Organization,
  fhirBundleDestinationKey: string
): ValidBundle {
  const docExtension: Extension = {
    url: "https://public.metriport.com/fhir/StructureDefinition/doc-id-extension.json",
    valueString: fhirBundleDestinationKey,
  };

  const fhirPatient = toFhirPatient(patient);
  const bundleWithExtensions = validateUuidsAndAddExtensions(bundle, docExtension, patient.id);
  const patientWithExtension = addUniqueExtension(fhirPatient, metriportDataSourceExtension);
  const organizationWithExtension = addUniqueExtension(org, metriportDataSourceExtension);
  bundleWithExtensions.entry?.push({ resource: patientWithExtension });
  bundleWithExtensions.entry?.push({ resource: organizationWithExtension });

  return bundleWithExtensions;
}

type ReplacementIdPair = { old: string; new: string };

function validateUuidsAndAddExtensions(
  bundle: ValidBundle,
  docExtension: Extension,
  patientId: string
): ValidBundle {
  const replacements: ReplacementIdPair[] = [];
  const uniqueIds = new Set<string>();
  bundle.entry.forEach(entry => {
    const resource: Resource = entry.resource;
    const oldId = resource.id;
    if (oldId) {
      if (uniqueIds.has(oldId)) {
        throw new BadRequestError(`Multiple resources with the same ID: ${oldId}`);
      }
      uniqueIds.add(oldId);

      if (!isValidUuid(oldId)) {
        replacements.push({
          old: oldId,
          new: uuidv7(),
        });
      }
    }
    verifyPatientReferences(resource, patientId);
    addUniqueExtension(entry.resource, metriportDataSourceExtension);
    addUniqueExtension(entry.resource, docExtension);
  });

  let bundleString = JSON.stringify(bundle);
  replacements.forEach((idPair: ReplacementIdPair) => {
    bundleString = bundleString.replaceAll(idPair.old, idPair.new);
  });
  return JSON.parse(bundleString);
}

function verifyPatientReferences(resource: Resource, patientId: string) {
  if ("subject" in resource) {
    const subject = resource.subject;
    if (subject && "reference" in subject) {
      comparePatientIds(subject, patientId);
    }
  }
  if ("patient" in resource) {
    comparePatientIds(resource.patient, patientId);
  }
}

function comparePatientIds(reference: Reference | undefined, patientId: string) {
  const refString = reference?.reference;
  const refId = refString?.split("Patient/")[1];
  console.log(refId, patientId, refId === patientId);
  if (refId != patientId) {
    throw new BadRequestError("Patient reference is pointing to another patient!");
  }
}

//eslint-disable-next-line @typescript-eslint/no-explicit-any
function addUniqueExtension(resource: any, extension: Extension) {
  if (!resource.extension) {
    resource.extension = [];
  }
  const extensionExists = resource.extension.some((ext: Extension) => ext.url === extension.url);
  if (!extensionExists) {
    resource.extension.push(extension);
  }
  return resource;
}
