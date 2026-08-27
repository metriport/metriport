import { z } from "zod";

/**
 * Canvas ADT event types.
 * @see https://docs.canvasmedical.com/sdk/effect-external-event/#common-event-types
 */
export const CanvasAdtEventType = {
  /** Admit/Visit Notification */
  admit: "ADT^A01",
  /** Transfer a Patient */
  transfer: "ADT^A02",
  /** Discharge/End Visit */
  discharge: "ADT^A03",
  /** Register a Patient */
  register: "ADT^A04",
  /** Update Patient Information */
  update: "ADT^A08",
  /** Cancel Admit/Visit Notification */
  cancelAdmit: "ADT^A11",
  /** Cancel Transfer */
  cancelTransfer: "ADT^A12",
  /** Cancel Discharge/End Visit */
  cancelDischarge: "ADT^A13",
} as const;
export type CanvasAdtEventType = (typeof CanvasAdtEventType)[keyof typeof CanvasAdtEventType];

export const canvasAdtEventTypes = [
  CanvasAdtEventType.admit,
  CanvasAdtEventType.transfer,
  CanvasAdtEventType.discharge,
  CanvasAdtEventType.register,
  CanvasAdtEventType.update,
  CanvasAdtEventType.cancelAdmit,
  CanvasAdtEventType.cancelTransfer,
  CanvasAdtEventType.cancelDischarge,
] as const;

export const canvasAdtEventTypeSchema = z.enum(canvasAdtEventTypes);

export const externalEventDataSchema = z.object({
  visitIdentifier: z.string(),
  messageControlId: z.string(),
  eventType: canvasAdtEventTypeSchema,
  eventDatetime: z.string().optional(),
  messageDatetime: z.string().optional(),
  informationSource: z.string().optional(),
  facilityName: z.string().optional(),
  rawMessage: z.string().optional(),
});
export type ExternalEventData = z.infer<typeof externalEventDataSchema>;

export type CreateExternalEventParams = {
  patient_id: string;
  visit_identifier: string;
  message_control_id: string;
  event_type: CanvasAdtEventType;
  event_datetime?: string;
  message_datetime?: string;
  information_source?: string;
  facility_name?: string;
  raw_message?: string;
};
