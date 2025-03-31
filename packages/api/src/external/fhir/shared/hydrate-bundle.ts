import { Extension, Reference, Resource } from "@medplum/fhirtypes";
import { Patient } from "@metriport/core/domain/patient";
import { buildDocIdFhirExtension } from "@metriport/core/external/fhir/shared/extensions/doc-id-extension";
import { metriportDataSourceExtension } from "@metriport/core/external/fhir/shared/extensions/metriport";
import { isValidUuid } from "@metriport/core/util/uuid-v7";
import { BadRequestError } from "@metriport/shared";
import { Bundle as ValidBundle } from "../../../routes/medical/schemas/fhir";
import { toFHIR as toFhirPatient } from "@metriport/core/external/fhir/patient/conversion";
import { buildBundleEntry } from "@metriport/core/external/fhir/shared/bundle";
import { cloneDeep } from "lodash";

/**
 * Removes the Patient resource if provided, adds the Metriport and Document extensions to all the provided resources,
 * ensures that all resources have UUIDs for IDs
 */
export function processUploadBundle(
  bundle: ValidBundle,
  patient: Patient,
  fhirBundleDestinationKey: string
): ValidBundle {
  const bundleWithoutPatient = removeProvidedPatientResource(bundle, patient.id);
  const docExtension = buildDocIdFhirExtension(fhirBundleDestinationKey);
  const bundleWithExtensions = validateUuidsAndAddExtensions(
    bundleWithoutPatient,
    docExtension,
    patient.id
  );
  const bundleWithCorrectPatient = addPatientResource(bundleWithExtensions, patient);
  return bundleWithCorrectPatient;
}

function validateUuidsAndAddExtensions(
  bundle: ValidBundle,
  docExtension: Extension,
  patientId: string
): ValidBundle {
  const uniqueIds = new Set<string>();
  bundle.entry.forEach(entry => {
    const resource: Resource = entry.resource;
    const oldId = resource.id;
    if (!oldId) {
      throw new BadRequestError(`${entry.resource.resourceType} resource is missing the ID!`);
    }
    if (!isValidUuid(oldId)) {
      throw new BadRequestError(`Invalid UUID: ${oldId}`);
    }
    if (uniqueIds.has(oldId)) {
      throw new BadRequestError(`Multiple resources with the same ID: ${oldId}`);
    }
    uniqueIds.add(oldId);

    verifyPatientReferences(resource, patientId);
    addUniqueExtension(entry.resource, metriportDataSourceExtension);
    addUniqueExtension(entry.resource, docExtension);
  });

  return bundle;
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
  if (refId?.trim().length === 0) {
    throw new BadRequestError("Missing ID in the Patient reference!");
  }
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

/**
 * Removes the FHIR Patient resource from the Bundle in case it was directly provided by the customer,
 * since we can't be sure it's consistent with the record in our system.
 */
function removeProvidedPatientResource(bundle: ValidBundle, id: string): ValidBundle {
  const entriesWithoutPatient = bundle.entry.filter(e => {
    const res: Resource = e.resource;
    if (res.resourceType === "Patient") {
      if (res.id !== id) {
        throw new BadRequestError("Patient ID does not match the Patient resource ID");
      }
      return false;
    }
    return true;
  });
  return {
    ...bundle,
    entry: entriesWithoutPatient,
  };
}

/**
 * Inserts the up-to-date FHIR representation of the patient as it's stored in our system.
 */
function addPatientResource(bundle: ValidBundle, patient: Patient): ValidBundle {
  const updBundle = cloneDeep(bundle);

  const fhirPatient = toFhirPatient(patient);
  const patientBundleEntry = buildBundleEntry(fhirPatient);

  return {
    ...updBundle,
    entry: [...updBundle.entry, patientBundleEntry],
  };
}
