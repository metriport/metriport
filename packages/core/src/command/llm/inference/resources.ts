import { Resource } from "@medplum/fhirtypes";
import { BadRequestError } from "@metriport/shared";
import { AnthropicMessageText } from "../../../external/bedrock/model/anthropic/messages";
import { chunk, partition } from "lodash";
import { AnthropicAgent } from "../../../external/bedrock/agent/anthropic";
import { BedrockRegion } from "../../../external/bedrock/client";
import { AnthropicModelVersion } from "../../../external/bedrock/model/anthropic/version";
import { isPatient } from "../../../external/fhir/shared";
import { executeAsynchronously } from "../../../util/concurrency";
import { errorToString } from "../../../util/error/shared";
import {
  defaultQuestions,
  getGroupedPrompt,
  getPrompt,
  questionsByResourceType,
  systemPrompt,
} from "./prompts";
import { out } from "../../../util/log";

const maxResourcesPerLlmRequest = 100;
const numberOfParallelCallsToLlm = 5;

const defaultModel: AnthropicModelVersion = "claude-sonnet-4";
const defaultRegion: BedrockRegion = "us-west-2";
const defaultMaxTokens = 1024;
const defaultTemperature = 0;

export type ResourceInference = {
  resourceType: string;
  // TODO Why many?
  // TODO Why many?
  // TODO Why many?
  resourceDisplays: string[];
  resources: Resource[];
  model?: AnthropicModelVersion | undefined;
  region?: BedrockRegion | undefined;
  maxTokens?: number | undefined;
  temperature?: number | undefined;
};

export async function summarizeResource({
  resourceType,
  resourceDisplays,
  resources,
  model,
  region,
  maxTokens,
  temperature,
}: ResourceInference): Promise<string | undefined> {
  const { log } = out(`summarizeResource`);

  const [patientResources, resourcesWithoutPatient] = partition(resources, isPatient);
  const chunksOfResources = chunk(resourcesWithoutPatient, maxResourcesPerLlmRequest);

  if (patientResources.length > 1) {
    log(`Found ${patientResources.length} patient resources - it shoudn't happen`);
  }
  const patientResource = patientResources[0];
  if (!patientResource) {
    throw new BadRequestError("Missing patient resource");
  }

  const baseRequest = {
    resourceType,
    resourceDisplays,
    model,
    region,
    maxTokens,
    temperature,
  };

  const responses: string[] = [];
  const errors: string[] = [];
  await executeAsynchronously<Resource[]>(
    chunksOfResources,
    async chunk => {
      try {
        const response = await summarizeLimitedGroupOfResources({
          ...baseRequest,
          resources: [patientResource, ...chunk],
        });
        responses.push(response);
      } catch (error) {
        errors.push(errorToString(error));
      }
    },
    {
      numberOfParallelExecutions: numberOfParallelCallsToLlm,
    }
  );
  if (errors.length > 0) {
    throw new BadRequestError("Error summarizing resources", undefined, {
      errors: errors.join(", "),
    });
  }

  if (responses.length > 1) {
    const groupedSummaries = await groupSummariesOfResources({
      ...baseRequest,
      responses,
    });
    return groupedSummaries;
  }

  const message = responses[0];
  return message;
}

export async function summarizeLimitedGroupOfResources({
  resourceType,
  resourceDisplays,
  resources,
  model = defaultModel,
  region = defaultRegion,
  maxTokens = defaultMaxTokens,
  temperature = defaultTemperature,
}: Required<Pick<ResourceInference, "resourceType" | "resourceDisplays" | "resources">> &
  Pick<ResourceInference, "model" | "region" | "maxTokens" | "temperature">): Promise<string> {
  const agent = new AnthropicAgent({
    version: model,
    region,
    systemPrompt,
    maxTokens,
    temperature,
    tools: [],
  });

  const resourcesAsString = JSON.stringify(resources);

  const questions =
    questionsByResourceType[resourceType as keyof typeof questionsByResourceType] ??
    defaultQuestions;

  const prompt = getPrompt({ resourceType, resourceDisplays, resourcesAsString, questions });

  agent.addUserMessageText(prompt);

  const response = await agent.continueConversation();

  const message = (response.content[response.content.length - 1] as AnthropicMessageText).text;
  return message;
}

export async function groupSummariesOfResources({
  resourceType,
  resourceDisplays,
  responses,
  model = defaultModel,
  region = defaultRegion,
  maxTokens = defaultMaxTokens,
  temperature = defaultTemperature,
}: { responses: string[] } & Required<
  Pick<ResourceInference, "resourceType" | "resourceDisplays">
> &
  Pick<ResourceInference, "model" | "region" | "maxTokens" | "temperature">): Promise<string> {
  const agent = new AnthropicAgent({
    version: model,
    region,
    systemPrompt,
    maxTokens,
    temperature,
    tools: [],
  });

  const questions =
    questionsByResourceType[resourceType as keyof typeof questionsByResourceType] ??
    defaultQuestions;

  const prompt = getGroupedPrompt({ resourceType, responses, resourceDisplays, questions });

  agent.addUserMessageText(prompt);

  const response = await agent.continueConversation();

  const message = (response.content[response.content.length - 1] as AnthropicMessageText).text;
  return message;
}
