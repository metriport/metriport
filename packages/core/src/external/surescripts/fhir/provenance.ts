import { Provenance, ProvenanceAgent } from "@medplum/fhirtypes";
import { ResponseDetail } from "../schema/response";
import { SURESCRIPTS_AGENT_ID } from "../constants";
import { NPI_SYSTEM } from "./constants";

export function getProvenance(detail: ResponseDetail): Provenance {
  return {
    resourceType: "Provenance",
    recorded: detail.sentTime.toISOString(),
    agent: [getProvenanceAgent(detail)],
  };
}

export function getProvenanceAgent(detail: ResponseDetail): ProvenanceAgent {
  return {
    id: SURESCRIPTS_AGENT_ID,
    who: {
      display: "Metriport <-> Surescripts",
      id: SURESCRIPTS_AGENT_ID,
      type: "Organization",
    },
    onBehalfOf: {
      identifier: {
        system: NPI_SYSTEM,
        value: detail.facilityNpiNumber,
      },
    },
  };
}
