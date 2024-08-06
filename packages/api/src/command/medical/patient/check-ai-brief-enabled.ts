import { capture, out } from "@metriport/core/util";
import BadRequestError from "../../../errors/bad-request";
import { isAiBriefEnabledForCx } from "../../../external/aws/app-config";

export async function checkAiBriefEnabled({
  cxId,
  generateAiBrief,
}: {
  cxId: string;
  generateAiBrief: boolean;
}): Promise<void> {
  const { log } = out(`AI Brief for cxId: ${cxId}`);
  if (!generateAiBrief) return;

  const isAiBriefFeatureFlagEnabled = await isAiBriefEnabledForCx(cxId);
  if (!isAiBriefFeatureFlagEnabled && generateAiBrief) {
    const msg = `CX requires AI Brief feature`;
    log(msg);
    capture.message(msg, {
      extra: {
        cxId,
        generateAiBrief,
        isAiBriefFeatureFlagEnabled,
      },
      level: "info",
    });
    throw new BadRequestError("Contact Metriport to enable the AI Brief feature.");
  }
}
