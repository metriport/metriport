import { Provenance, ProvenanceAgent } from "@medplum/fhirtypes";
import { FlatFileDetail } from "../schema/response";
import { SURESCRIPTS_AGENT_ID } from "../constants";

export function parseProvenance(detail: FlatFileDetail): Provenance {
  return {
    resourceType: "Provenance",
    recorded: detail.sentTime.toISOString(),
    agent: [{}],
  };
}

export function parseProvenanceAgent(detail: FlatFileDetail): ProvenanceAgent {
  return {
    id: SURESCRIPTS_AGENT_ID,
    who: {
      display: "Metriport Surescripts Integration",
      id: SURESCRIPTS_AGENT_ID,
      type: "Organization",
    },
    onBehalfOf: {
      identifier: {
        system: "http://hl7.org/fhir/sid/npi",
        value: detail.prescriberNPI,
      },
    },
  };
}
