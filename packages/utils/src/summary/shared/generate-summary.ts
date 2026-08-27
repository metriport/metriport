import { generateAiBriefBundleEntry } from "@metriport/core/domain/ai-brief/generate";
import { Bundle } from "@medplum/fhirtypes";
import { AiBriefControls, AiBriefModel } from "@metriport/core/command/ai-brief/shared";
import { base64ToString } from "@metriport/shared";

export async function generateAiSummary({
  bundle,
  cxId,
  patientId,
  model,
}: {
  bundle: Bundle;
  cxId: string;
  patientId: string;
  model?: AiBriefModel;
}): Promise<{
  summary: string;
  durationInMs: number;
  inputTokensUsed?: number;
  outputTokensUsed?: number;
}> {
  const start = Date.now();
  const aiBriefControls: AiBriefControls = {
    cancelled: false,
    model,
  };
  const bundleEntry = await generateAiBriefBundleEntry({
    bundle,
    cxId,
    patientId,
    log: () => {
      return;
    },
    aiBriefControls,
  });
  const summary = base64ToString(bundleEntry?.resource?.data ?? "");
  const durationInMs = Date.now() - start;
  const { inputTokensUsed, outputTokensUsed } = aiBriefControls;
  return { summary, durationInMs, inputTokensUsed, outputTokensUsed };
}
