import { Hl7Message, Hl7Context, Hl7Field, Hl7Segment } from "@medplum/core";

// Helper function to create test HL7 messages
export function makeHl7Message({
  mshSendingApp = "",
  mshDatetimeOfMessage = "20250102120000",
  evnRecordedDatetime = "",
  dg1DiagnosisDatetime = "",
  pv1AdmitDatetime = "",
  pv1DischargeDatetime = "",
}: {
  mshSendingApp?: string;
  mshDatetimeOfMessage?: string;
  evnRecordedDatetime?: string;
  dg1DiagnosisDatetime?: string;
  pv1AdmitDatetime?: string;
  pv1DischargeDatetime?: string;
}): Hl7Message {
  // Create a default HL7 context with standard separators
  const context = new Hl7Context();

  // Create MSH segment
  const mshFields = [
    new Hl7Field([["MSH"]], context),
    new Hl7Field([["^~\\&"]], context),
    new Hl7Field([[mshSendingApp]], context), // Field 3: Sending Application
    new Hl7Field([["SENDING_FACILITY"]], context),
    new Hl7Field([["RECEIVING_APP"]], context),
    new Hl7Field([["RECEIVING_FACILITY"]], context),
    new Hl7Field([[mshDatetimeOfMessage]], context), // Field 7: DateTime of Message
    new Hl7Field([[""]], context),
    new Hl7Field([["ADT", "A01"]], context), // Field 9: Message Type
    new Hl7Field([["MSG123"]], context), // Field 10: Message Control ID
  ];
  const mshSegment = new Hl7Segment(mshFields, context);

  // Create EVN segment
  const evnFields = [
    new Hl7Field([["EVN"]], context),
    new Hl7Field([["A01"]], context), // Field 1: Event Type Code
    new Hl7Field([[evnRecordedDatetime]], context), // Field 2: Recorded DateTime
    new Hl7Field([[""]], context), // Field 3: DateTime Planned Event
    new Hl7Field([[""]], context), // Field 4: Event Reason Code
    new Hl7Field([[""]], context), // Field 5: Operator ID
    new Hl7Field([[""]], context), // Field 6: Event Occurred
  ];
  const evnSegment = new Hl7Segment(evnFields, context);

  // Create PID segment
  const pidFields = [
    new Hl7Field([["PID"]], context),
    new Hl7Field([["1"]], context),
    new Hl7Field([[""]], context),
    new Hl7Field([["12345"]], context), // Field 3: Patient ID
  ];
  const pidSegment = new Hl7Segment(pidFields, context);

  // Create PV1 segment
  const pv1Fields = [
    new Hl7Field([["PV1"]], context),
    new Hl7Field([["1"]], context),
    new Hl7Field([["I"]], context), // Field 2: Patient Class

    // Add empty fields to reach field 44 and 45
    ...Array(41).fill(new Hl7Field([[""]], context)),
    new Hl7Field([[pv1AdmitDatetime]], context), // Field 44: Admit Date
    new Hl7Field([[pv1DischargeDatetime]], context), // Field 45: Discharge Date
  ];
  const pv1Segment = new Hl7Segment(pv1Fields, context);

  // Create 3 DG1 segments
  const dg1Segments = [];
  for (let i = 1; i <= 3; i++) {
    const dg1Fields = [
      new Hl7Field([["DG1"]], context),
      new Hl7Field([[i.toString()]], context), // Field 1: Set ID
      new Hl7Field([[""]], context),
      new Hl7Field([[""]], context),
      new Hl7Field([[""]], context),
      new Hl7Field([[dg1DiagnosisDatetime]], context), // Field 5: Diagnosis DateTime
    ];
    dg1Segments.push(new Hl7Segment(dg1Fields, context));
  }

  return new Hl7Message([mshSegment, evnSegment, pidSegment, pv1Segment, ...dg1Segments], context);
}
