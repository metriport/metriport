import { BadRequestError } from "@metriport/shared";
import { capture, out } from "@metriport/core/util";
import { isAiBriefEnabledForCx } from "../../../external/aws/app-config";

// TODO merge this with lambda's isAiBriefEnabled and move it to Core
/**
 * If enabled to the customer, it defaults to true - they have to explicitly disable it for a
 * given request if their account is enabled for it.
 */
export async function checkAiBriefEnabled({
  cxId,
  generateAiBrief,
}: {
  cxId: string;
  generateAiBrief: boolean | undefined;
}): Promise<boolean> {
  const { log } = out(`AI Brief for cxId: ${cxId}`);
  if (generateAiBrief === false) return false;

  const isAiBriefFeatureFlagEnabled = await isAiBriefEnabledForCx(cxId);
  if (isAiBriefFeatureFlagEnabled) {
    return true;
  }
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
  return false;
}
