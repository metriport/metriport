import { uuidv7 } from "@metriport/shared/util/uuid-v7";
import { Patient, Practitioner, Reference, ServiceRequest, Specimen } from "@medplum/fhirtypes";
import { ResponseDetail } from "../schema/response";
import { getPatientReference } from "./patient";
import { getPractitionerReference } from "./practitioner";
import { getQuestDataSourceExtension } from "./shared";
import { getServiceRequestReference } from "./service-request";

export function getSpecimen(
  detail: ResponseDetail,
  {
    patient,
    practitioner,
    serviceRequest,
  }: { patient: Patient; practitioner: Practitioner; serviceRequest: ServiceRequest }
): Specimen | undefined {
  if (!detail.dateCollected) return undefined;
  const extension = [getQuestDataSourceExtension()];
  const subject = getPatientReference(patient);
  const collector = getPractitionerReference(practitioner);
  const request = [getServiceRequestReference(serviceRequest)];
  const collectedDateTime = detail.dateCollected.toISOString();

  return {
    resourceType: "Specimen",
    id: uuidv7(),
    status: "available",
    subject,
    collection: {
      collector,
      collectedDateTime,
    },
    request,
    extension,
  };
}

export function getSpecimenReference(specimen: Specimen): Reference<Specimen> {
  return {
    reference: `Specimen/${specimen.id}`,
  };
}
