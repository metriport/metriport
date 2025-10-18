import {
  summarizeContext,
  SummaryResult,
} from "@metriport/core/command/llm/inference/resource-summary";
import {
  defaultTemplateHandler,
  templateHandlersByResourceType,
} from "@metriport/core/command/llm/inference/prompts";
import { AdvancedMetric, reportAdvancedMetrics } from "@metriport/core/external/aws/cloudwatch";
import { initTimer } from "@metriport/shared/common/timer";
import { Request, Response } from "express";
import Router from "express-promise-router";
import status from "http-status";
import { z } from "zod";
import { handleParams } from "../helpers/handle-params";
import { requestLogger } from "../helpers/request-logger";
import { asyncHandler, getCxIdOrFail } from "../util";
import { out } from "@metriport/core/util/log";

const router = Router();

const resourceSummaryInferenceSchema = z.object({
  resourceType: z.string(),
  resourceDisplays: z.array(z.string()),
  resourceRowData: z.record(z.unknown()).optional(),
  context: z.string(),
  suspectsContext: z.string().optional(),
});

/** ---------------------------------------------------------------------------
 * POST /internal/inference/resource/summary
 *
 * Runs a Q&A style summary over some context surrounding a resource.
 * Returns a JSON response with the AI-generated summary.
 */
router.post(
  "/resource/summary",
  handleParams,
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);
    const { log } = out(`resource/summary - cx: ${cxId}`);
    const { resourceType, resourceDisplays, resourceRowData, context, suspectsContext } =
      resourceSummaryInferenceSchema.parse(req.body);
    log(`resourceType: ${resourceType}, resourceDisplays: ${resourceDisplays.join(", ")}`);

    const templateHandler = templateHandlersByResourceType[resourceType] ?? defaultTemplateHandler;

    // Build context based on resource type (handle suspectsContext)
    let finalContext = context;
    if (resourceType === "Suspects" && suspectsContext) {
      finalContext = `
## Suspect Analysis Context

The following FHIR resources were identified as responsible for creating this suspect:

${suspectsContext}

---

## Patient's Medical Record Context
${context}
`;
    }

    const customPromptSection = templateHandler({
      resourceType,
      resourceDisplays,
      resourceRowData,
    });

    const timer = initTimer();
    const result = await summarizeContext({
      resourceType,
      resourceDisplays,
      customPromptSection,
      context: finalContext,
      resourceRowData,
    });
    const duration = timer.getElapsedTime();

    await reportResourceSummaryMetrics({ cxId, duration, result });

    return res.status(status.OK).json({ summary: result.summary });
  })
);

async function reportResourceSummaryMetrics({
  cxId,
  duration,
  result,
}: {
  cxId: string;
  duration: number;
  result: SummaryResult;
}): Promise<void> {
  const metrics: AdvancedMetric[] = [
    {
      name: "LLM.ResourceSummary.Duration",
      unit: "Milliseconds",
      value: duration,
      dimensions: {
        Customer: cxId,
      },
    },
    {
      name: "LLM.ResourceSummary.InputTokens",
      unit: "Count",
      value: result.inputTokens ?? 0,
      dimensions: {
        Customer: cxId,
      },
    },
    {
      name: "LLM.ResourceSummary.OutputTokens",
      unit: "Count",
      value: result.outputTokens ?? 0,
      dimensions: {
        Customer: cxId,
      },
    },
  ];

  if (result.chunksDuration !== undefined) {
    metrics.push({
      name: "LLM.ResourceSummary.ChunksDuration",
      unit: "Milliseconds",
      value: result.chunksDuration,
      dimensions: {},
    });
  }

  if (result.collationDuration !== undefined) {
    metrics.push({
      name: "LLM.ResourceSummary.CollationDuration",
      unit: "Milliseconds",
      value: result.collationDuration,
      dimensions: {},
    });
  }

  await reportAdvancedMetrics({
    service: "OSS API",
    metrics,
  });
}

export default router;
