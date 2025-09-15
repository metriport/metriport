const supportedTypes = ["A01", "A03", "A04"] as const;

export type SupportedTriggerEvent = (typeof supportedTypes)[number];
export function isSupportedTriggerEvent(
  triggerEvent: string
): triggerEvent is SupportedTriggerEvent {
  return supportedTypes.includes(triggerEvent as SupportedTriggerEvent);
}
