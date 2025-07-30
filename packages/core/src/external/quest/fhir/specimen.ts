import { uuidv7 } from "@metriport/shared/util/uuid-v7";
import { Practitioner, Reference, ServiceRequest, Specimen } from "@medplum/fhirtypes";
import { ResponseDetail } from "../schema/response";

export function getSpecimen(
  detail: ResponseDetail,
  { practitioner, serviceRequest }: { practitioner: Practitioner; serviceRequest: ServiceRequest }
): Specimen | undefined {
  if (!detail.dateCollected) return undefined;

  return {
    resourceType: "Specimen",
    id: uuidv7(),
    status: "available",
    collection: {
      collector: {
        reference: `Practitioner/${practitioner.id}`,
      },
    },
    request: [
      {
        reference: `ServiceRequest/${serviceRequest.id}`,
      },
    ],
  };
}

export function getSpecimenReference(specimen: Specimen): Reference<Specimen> {
  return {
    reference: `Specimen/${specimen.id}`,
  };
}
