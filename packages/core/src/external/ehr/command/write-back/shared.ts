import { Condition, DiagnosticReport, Observation, Resource } from "@medplum/fhirtypes";
import { BadRequestError } from "@metriport/shared";
import { EhrSource } from "@metriport/shared/interface/external/ehr/source";
import { writeBackCondition } from "./condition";
import { writeBackGroupedVitals } from "./grouped-vitals";
import { writeBackLab } from "./lab";
import { writeBackLabPanel } from "./lab-panel";

export type WriteBackResourceType = "condition" | "lab" | "lab-panel" | "grouped-vitals";

export type WriteBackResourceRequest = {
  ehr: EhrSource;
  tokenId?: string;
  cxId: string;
  practiceId: string;
  ehrPatientId: string;
  primaryResourceOrResources: Resource | Resource[];
  secondaryResourceOrResources?: Resource | Resource[];
  writeBackResource: WriteBackResourceType;
};

export type WriteBackResourceClientRequest = Omit<WriteBackResourceRequest, "ehr">;

export async function writeBackResource({ ...params }: WriteBackResourceRequest): Promise<void> {
  if (params.writeBackResource === "condition") {
    return await writeBackCondition({
      ...params,
      condition: params.primaryResourceOrResources as Condition,
    });
  } else if (params.writeBackResource === "lab") {
    return await writeBackLab({
      ...params,
      observation: params.primaryResourceOrResources as Observation,
    });
  } else if (params.writeBackResource === "lab-panel") {
    return await writeBackLabPanel({
      ...params,
      diagnostricReport: params.primaryResourceOrResources as DiagnosticReport,
      observations: params.secondaryResourceOrResources as Observation[],
    });
  } else if (params.writeBackResource === "grouped-vitals") {
    return await writeBackGroupedVitals({
      ...params,
      observations: params.primaryResourceOrResources as Observation[],
    });
  }
  throw new BadRequestError("Could not find handler to write back resource", undefined, {
    ehr: params.ehr,
    writeBackResource: params.writeBackResource,
  });
}
