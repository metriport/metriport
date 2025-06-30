import { Condition, Observation, Resource } from "@medplum/fhirtypes";
import { BadRequestError } from "@metriport/shared";
import { EhrSource } from "@metriport/shared/interface/external/ehr/source";
import { isLab, isVital } from "../../shared";
import { writeBackCondition } from "./condition";
import { writeBackLab } from "./lab";
import { writeBackVital } from "./vital";

export type WriteBackConditionRequest = {
  ehr: EhrSource;
  tokenId?: string;
  cxId: string;
  practiceId: string;
  ehrPatientId: string;
  resource: Resource;
};

export type WriteBackConditionClientRequest = Omit<WriteBackConditionRequest, "ehr">;

export async function writeBackResource({ ...params }: WriteBackConditionRequest): Promise<void> {
  const resourceType = params.resource.resourceType;
  if (resourceType === "Condition") {
    const condition = params.resource as Condition;
    return await writeBackCondition({ ...params, condition });
  } else if (resourceType === "Observation") {
    const observation = params.resource as Observation;
    if (isVital(observation)) {
      return await writeBackVital({ ...params, observation });
    } else if (isLab(observation)) {
      return await writeBackLab({ ...params, observation });
    }
  } else {
    throw new BadRequestError("Could not find handler to write back resource", undefined, {
      ehr: params.ehr,
      resourceType,
    });
  }
}
