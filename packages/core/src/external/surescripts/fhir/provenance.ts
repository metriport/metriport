import { Provenance, ProvenanceAgent } from "@medplum/fhirtypes";
import { ResponseDetail } from "../schema/response";
import { SURESCRIPTS_AGENT_ID } from "../constants";
import { NPI_URL } from "./constants";
import { getSurescriptsDataSourceExtension } from "./shared";

export function getProvenance(detail: ResponseDetail): Provenance {
  const agent = [getProvenanceAgent(detail)];
  const extension = [getSurescriptsDataSourceExtension()];

  return {
    resourceType: "Provenance",
    recorded: detail.sentTime.toISOString(),
    agent,
    extension,
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
        system: NPI_URL,
        value: detail.facilityNpiNumber,
      },
    },
  };
}
