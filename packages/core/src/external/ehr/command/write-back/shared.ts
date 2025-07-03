import { Condition, Observation, Resource } from "@medplum/fhirtypes";
import { BadRequestError } from "@metriport/shared";
import { EhrSource } from "@metriport/shared/interface/external/ehr/source";
import { writeBackCondition } from "./condition";
import { writeBackLab } from "./lab";
import { writeBackVital } from "./vital";

export type WriteBackResourceType = "condition" | "lab" | "vital";

export type WriteBackConditionRequest = {
  ehr: EhrSource;
  tokenId?: string;
  cxId: string;
  practiceId: string;
  ehrPatientId: string;
  resource: Resource;
  writeBackResource: WriteBackResourceType;
};

export type WriteBackConditionClientRequest = Omit<WriteBackConditionRequest, "ehr">;

export async function writeBackResource({ ...params }: WriteBackConditionRequest): Promise<void> {
  if (params.writeBackResource === "condition") {
    return await writeBackCondition({ ...params, condition: params.resource as Condition });
  } else if (params.writeBackResource === "lab") {
    return await writeBackLab({ ...params, observation: params.resource as Observation });
  } else if (params.writeBackResource === "vital") {
    return await writeBackVital({ ...params, observation: params.resource as Observation });
  }
  throw new BadRequestError("Could not find handler to write back resource", undefined, {
    ehr: params.ehr,
    writeBackResource: params.writeBackResource,
    resourceType: params.resource.resourceType,
  });
}
