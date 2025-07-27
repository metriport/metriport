import { Practitioner, ServiceRequest, Specimen } from "@medplum/fhirtypes";
import { ResponseDetail } from "../schema/response";

export function getSpecimen(
  detail: ResponseDetail,
  { practitioner, serviceRequest }: { practitioner: Practitioner; serviceRequest: ServiceRequest }
): Specimen | undefined {
  if (!detail.dateCollected) return undefined;

  return {
    resourceType: "Specimen",
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
