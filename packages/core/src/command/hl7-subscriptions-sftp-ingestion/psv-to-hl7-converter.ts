import { Hl7Message } from "@medplum/core";
import { MetriportError } from "@metriport/shared";
import { buildDayjs, buildDayjsTz } from "@metriport/shared/common/date";
import csv from "csv-parser";
import { Readable } from "stream";
import { getCxIdAndPatientIdOrFail } from "../hl7v2-subscriptions/hl7v2-to-fhir-conversion/shared";
import { capture } from "../../util/notifications";
import { Row, rowSchema } from "./psv-converter-schema";

enum SUPPORTED_ADT {
  ADT_A01 = "ADT_A01",
  ADT_A03 = "ADT_A03",
}

export type IdentifiedHl7Message = {
  cxId: string;
  ptId: string;
  hl7Message: Hl7Message;
};

export class PsvToHl7Converter {
  private static readonly FIELD_SEPARATOR = "|";
  private static readonly HL7_VERSION = "2.5.1";
  private static readonly ENCODING_CHARS = "^~\\&";
  private static readonly SENDING_APP = "LAHIESFTP";
  private static readonly DEFAULT_RECEIVING_APP = "METRIPORT";
  private static readonly PROCESSING_ID = "P";

  private static readonly HEADER_ROW =
    "FacilityAbbrev|FacilityName|VisitNumber|PatientID|LastName|FirstName|MiddleName|StreetAddress|City|State|ZipCode|PrimaryPhoneNumber|SSN|PatientDateofBirth|Gender|MaritalStatus|AdmitDateTime|ChiefComplaint|DiagnosisCode|DiagnosisText|DiagnosisCodingSystem|AttendingPhysicianName|ReferringPhysicianName|AdmittingPhysicianName|SendingToSystem|MetriplexPatID|DischargeDateTime|EmergencySeverityLevel|PatClass";

  private readonly psvBuffer: Buffer;

  constructor(psvBuffer: Buffer) {
    this.psvBuffer = psvBuffer;
  }

  public getPsvBuffer(): Buffer {
    return this.psvBuffer;
  }

  public async getIdentifiedHl7Messages(): Promise<IdentifiedHl7Message[]> {
    const hl7Messages = await this.getHl7Messages();
    const identifiedMessages: IdentifiedHl7Message[] = [];

    for (const msg of hl7Messages) {
      const { cxId, patientId } = getCxIdAndPatientIdOrFail(msg);
      identifiedMessages.push({
        cxId,
        ptId: patientId,
        hl7Message: msg,
      });
    }

    return identifiedMessages;
  }

  public async getHl7Messages(): Promise<Hl7Message[]> {
    const stringMessages = await this.getHl7MessageStrings();
    const messages: Hl7Message[] = [];
    for (const stringMsg of stringMessages) {
      messages.push(Hl7Message.parse(stringMsg));
    }
    return messages;
  }

  public async getHl7MessageStrings(): Promise<string[]> {
    const rows = await this.getAllRowsAsync();

    const messages: string[] = [];
    for (const row of rows) {
      const msg = this.buildMessageFromRow(row);
      messages.push(msg);
    }

    return messages;
  }

  private async getAllRowsAsync(): Promise<Row[]> {
    const text = this.psvBuffer.toString("utf8");
    const expectedHeader = PsvToHl7Converter.HEADER_ROW.trim();
    const firstLine = text.split(/\r?\n/, 1)[0]?.trim() ?? "";
    const hasHeader = firstLine === expectedHeader;

    const rows: Row[] = [];
    const stream = Readable.from([text]);
    let isFirstRow = hasHeader;

    await new Promise<void>((resolve, reject) => {
      stream
        .pipe(
          csv({
            separator: PsvToHl7Converter.FIELD_SEPARATOR,
            headers: expectedHeader.split(PsvToHl7Converter.FIELD_SEPARATOR),
          })
        )
        //eslint-disable-next-line @typescript-eslint/no-explicit-any
        .on("data", (row: any) => {
          if (isFirstRow) {
            isFirstRow = false;
            return;
          }

          const trimmedRow = Object.fromEntries(
            Object.entries(row).map(([key, value]) => [key, String(value ?? "").trim()])
          );

          if (!Object.values(trimmedRow).some(v => v !== "")) {
            return;
          }

          const parseResult = rowSchema.safeParse(trimmedRow);
          if (parseResult.success) {
            rows.push(parseResult.data);
          } else {
            capture.error(parseResult.error, {
              extra: {
                facility: trimmedRow.FacilityAbbrev || trimmedRow.FacilityName,
                patientId: trimmedRow.PatientID || trimmedRow.MetriplexPatID,
                rawRow: trimmedRow,
              },
            });
            rows.push(trimmedRow as Row);
          }
        })
        .on("end", () => resolve())
        .on("error", err => reject(err));
    });
    return rows;
  }

  private buildMessageFromRow(row: Row): string {
    const segments = [
      this.buildMshFromRow(row),
      this.buildEvnFromRow(row),
      this.buildPidFromRow(row),
      this.buildPv1FromRow(row),
      this.buildPv2FromRow(row),
      this.buildDg1FromRow(row),
    ].filter(Boolean);

    return segments.join("\r");
  }

  ///////////////////////////////////////
  //            SEGMENTS               //
  ///////////////////////////////////////

  private buildMshFromRow(row: Row): string {
    const trigger = this.getTriggerEvent(row);
    const ev = trigger.split("_")[1];
    const msh9 = `ADT^${ev}^ADT_${ev}`;

    const fields: string[] = [];
    fields[1] = PsvToHl7Converter.ENCODING_CHARS;
    fields[2] = this.escapeHl7Text(PsvToHl7Converter.SENDING_APP);
    fields[3] = this.escapeHl7Text(row.facilityName || row.facilityAbbrev);
    fields[4] = this.escapeHl7Text(row.sendingToSystem || PsvToHl7Converter.DEFAULT_RECEIVING_APP);
    fields[5] = this.escapeHl7Text(row.sendingToSystem || PsvToHl7Converter.DEFAULT_RECEIVING_APP);
    fields[6] = this.getMessageTime();
    fields[8] = msh9;
    fields[9] = this.escapeHl7Text(this.getMessageControlId(row));
    fields[10] = PsvToHl7Converter.PROCESSING_ID;
    fields[11] = PsvToHl7Converter.HL7_VERSION;

    return this.joinFields("MSH", fields);
  }

  private buildEvnFromRow(row: Row): string {
    const trigger = this.getTriggerEvent(row);
    const eventCode = trigger.split("_")[1];
    if (!eventCode) {
      throw new MetriportError(
        "Could not figure out which trigger event is for this ADT.",
        undefined,
        {
          triggerEvent: trigger,
        }
      );
    }

    const recordedTs = this.getMessageTime();
    const eventOccurredTs =
      this.toHl7Ts(trigger === SUPPORTED_ADT.ADT_A03 ? row.dischargeDateTime : row.admitDateTime) ||
      recordedTs;

    const eventFacility = this.escapeHl7Text(row.facilityName || row.facilityAbbrev);

    const fields: string[] = [];
    fields[1] = eventCode;
    fields[2] = recordedTs;
    fields[6] = eventOccurredTs;
    fields[7] = eventFacility;
    return this.joinFields("EVN", fields);
  }

  private buildPidFromRow(row: Row): string {
    const assigningAuthority = this.escapeHl7Text(row.facilityAbbrev);

    const pid3PtIdList = [
      `${this.escapeHl7Text(row.metriplexPatID)}^^^${assigningAuthority}`,
      `${this.escapeHl7Text(row.patientID)}^^^${assigningAuthority}`,
    ].join("~");

    const pid5Name = this.buildNameXpn(row.firstName, row.middleName, row.lastName);
    const pid7Dob = row.patientDateofBirth;
    const pid8Sex = this.escapeHl7Text(row.gender || "U");
    const pid11Addr = [
      this.escapeHl7Text(row.streetAddress),
      "",
      this.escapeHl7Text(row.city),
      this.escapeHl7Text(row.state),
      this.escapeHl7Text(row.zipCode),
    ].join("^");

    const phoneDigits = this.digitsOnly(row.primaryPhoneNumber);
    const pid13Phone = ["", "PRN", "PH", "", "", "", phoneDigits].join("^");
    const pid16Marital = this.escapeHl7Text(row.maritalStatus);
    const pid19Ssn = this.escapeHl7Text(row.ssn);

    const fields: string[] = [];
    fields[1] = "1";
    fields[2] = this.escapeHl7Text(row.metriplexPatID);
    fields[3] = pid3PtIdList;
    fields[5] = pid5Name;
    fields[7] = pid7Dob;
    fields[8] = pid8Sex;
    fields[11] = pid11Addr;
    fields[13] = pid13Phone;
    fields[16] = pid16Marital;
    fields[19] = pid19Ssn;

    return this.joinFields("PID", fields);
  }

  private buildPv1FromRow(row: Row): string {
    const triggerEvent = this.getTriggerEvent(row);
    const fields = this.buildGeneralPv1FromRow(row);
    const admitTs = this.extractTimestamp(row.admitDateTime);
    const dischargeTs =
      triggerEvent === SUPPORTED_ADT.ADT_A03 ? this.extractTimestamp(row.dischargeDateTime) : "";

    fields[44] = admitTs;
    fields[45] = dischargeTs;

    this.trimTrailingEmpty(fields);
    return this.joinFields("PV1", fields);
  }

  private buildGeneralPv1FromRow(row: Row): string[] {
    const fields: string[] = [];

    fields[1] = "1";
    fields[2] = this.escapeHl7Text(row.patClass || "O");
    fields[3] = this.buildPlFromFacility(row);
    fields[4] = this.isEmergency(row) ? "E" : "R";
    fields[7] = this.buildXcnFromFullName(row.attendingPhysicianName);
    fields[8] = this.buildXcnFromFullName(row.referringPhysicianName);
    fields[10] = this.isEmergency(row) ? "EMER" : "";
    fields[17] = this.buildXcnFromFullName(row.admittingPhysicianName);
    fields[18] = this.escapeHl7Text(row.patClass);
    fields[19] = this.buildVisitNumber(row.visitNumber, row.sendingToSystem, "VN");
    fields[39] = this.escapeHl7Text(row.facilityAbbrev || row.facilityName);

    return fields;
  }

  private buildPv2FromRow(row: Row): string {
    const fields: string[] = [];

    const id = row.diagnosisCode;
    const text = row.diagnosisText;
    const system = row.diagnosisCodingSystem;
    fields[3] = this.buildCweSimple(id, text, system);
    fields[8] = this.toHl7Ts(row.admitDateTime);
    fields[9] = this.toHl7Ts(row.dischargeDateTime);
    fields[11] = this.calculateLengthOfStay(row.admitDateTime, row.dischargeDateTime);
    fields[12] = this.escapeHl7Text(row.chiefComplaint);
    fields[23] = this.escapeHl7Text(row.facilityName);
    fields[24] = this.buildCweSimple(row.patClass);
    fields[40] = this.buildCweSimple(row.emergencySeverityLevel, "ESI triage level", "ESI");

    return this.joinFields("PV2", fields);
  }

  private buildDg1FromRow(row: Row): string {
    const trigger = this.getTriggerEvent(row);
    const fields: string[] = [];
    fields[1] = "1";

    const diagnosisCwe = this.buildCweSimple(
      row.diagnosisCode,
      row.diagnosisText,
      row.diagnosisCodingSystem
    );

    fields[3] = diagnosisCwe;
    fields[4] = this.escapeHl7Text(row.diagnosisText);
    fields[5] = this.toHl7Ts(
      trigger === SUPPORTED_ADT.ADT_A01 ? row.admitDateTime : row.dischargeDateTime
    );
    fields[6] = trigger === SUPPORTED_ADT.ADT_A01 ? "A" : "F";
    fields[15] = "1";

    return this.joinFields("DG1", fields);
  }

  ///////////////////////////////////////
  //              HELPERS              //
  ///////////////////////////////////////

  /**
   * HL7 segments MUST start with an empty field.
   * We do this to match the Hl7 spec. Since the spec starts at 1 and not 0.
   * @param name name of the segment
   * @param fields fields in that segment
   * @returns the segment as a string
   */
  private joinFields(name: string, fields: string[]): string {
    if (fields[0] && fields[0] !== "") {
      throw new MetriportError(
        "First field of a segment MUST be empty to match HL7 spec (1-based indexing)",
        undefined,
        { segment: name, firstField: fields[0] }
      );
    }

    const trimmedFields = fields.slice(1);

    return `${name}${PsvToHl7Converter.FIELD_SEPARATOR}${trimmedFields.join(
      PsvToHl7Converter.FIELD_SEPARATOR
    )}`;
  }

  private extractTimestamp(dateTime?: string): string {
    return this.digitsOnly(dateTime).slice(0, 14);
  }

  private buildCweSimple(id?: string, text?: string, system?: string): string {
    const components = [id, text, system].filter(comp => comp && comp.trim() !== "");
    return components.join("^");
  }

  private buildNameXpn(
    firstName: string | undefined,
    middleName: string | undefined,
    lastName: string | undefined
  ): string {
    const parts = [(lastName ?? "").trim(), (firstName ?? "").trim(), (middleName ?? "").trim()];
    return this.joinHl7Fields(parts, "^");
  }

  private buildXcnFromFullName(fullName?: string): string {
    if (!fullName) return "";

    const [lastRaw = "", restRaw = ""] = fullName.split(",", 2);
    const last = lastRaw.trim();

    const tokens = restRaw.trim().split(/\s+/).filter(Boolean);
    const first = (tokens[0] ?? "").trim();
    const middle = tokens.slice(1).join(" ").trim();

    // Extract DR prefix because we expect a lot of doctors. Leave other prefixes.
    const DR_PREFIX = "Dr.";
    const familyName = last.startsWith(DR_PREFIX) ? last.substring(DR_PREFIX.length).trim() : last;
    const prefix = last.startsWith(DR_PREFIX) ? DR_PREFIX : "";

    return this.joinHl7Fields(["", familyName, first, middle, "", prefix], "^");
  }

  private buildPlFromFacility(row: Row): string {
    const facility = row.facilityAbbrev || row.facilityName;
    return `^^^${this.escapeHl7Text(facility)}`;
  }

  private buildVisitNumber(id?: string, assigningAuthority?: string, idType?: string): string {
    return this.joinHl7Fields([id, "", "", assigningAuthority, idType], "^");
  }

  private joinHl7Fields(fields: (string | undefined)[], separator: string): string {
    const escapedFields = fields.map(field => this.escapeHl7Text(field));
    this.trimTrailingEmpty(escapedFields);
    return escapedFields.join(separator);
  }

  private isEmergency(row: Row): boolean {
    return (
      !!(row.emergencySeverityLevel && row.emergencySeverityLevel.trim()) || row.patClass === "E"
    );
  }

  private trimTrailingEmpty(parts: string[]): void {
    let i = parts.length - 1;
    while (i >= 0 && parts[i] === "") i--;
    parts.length = i + 1;
  }

  private getMessageControlId(row: Row): string {
    const base = row.visitNumber || row.patientID || row.metriplexPatID || "NA";
    const trigger = this.getTriggerEvent(row);
    const timeStamp = trigger === SUPPORTED_ADT.ADT_A03 ? row.dischargeDateTime : row.admitDateTime;
    const timestamp = this.toHl7Ts(timeStamp);
    return `${base}_${timestamp}`;
  }

  private escapeHl7Text(input?: string): string {
    if (!input) return "";
    return input
      .replace(/[\r\n]+/g, " ")
      .replace(/\\/g, "\\E\\")
      .replace(/\|/g, "\\F\\")
      .replace(/\^/g, "\\S\\")
      .replace(/~/g, "\\R\\")
      .replace(/&/g, "\\T\\");
  }

  private getTriggerEvent(row: Row): SUPPORTED_ADT {
    if (row.dischargeDateTime) {
      return SUPPORTED_ADT.ADT_A03;
    } else {
      return SUPPORTED_ADT.ADT_A01;
    }
  }

  private getMessageTime(): string {
    // Use current time in Chicago timezone, which will be converted to UTC by the webhook sender
    return buildDayjsTz(new Date(), "America/Chicago").format("YYYYMMDDHHmmss");
  }

  private digitsOnly(s?: string): string {
    return (s ?? "").replace(/\D+/g, "");
  }

  private toHl7Ts(s?: string): string {
    if (!s) return "";
    try {
      return buildDayjs(s).format("YYYYMMDDHHmmss");
    } catch {
      return "";
    }
  }

  private calculateLengthOfStay(admitDateTime?: string, dischargeDateTime?: string): string {
    if (!admitDateTime || !dischargeDateTime) return "";

    try {
      const admitDate = this.parseHl7Timestamp(admitDateTime);
      const dischargeDate = this.parseHl7Timestamp(dischargeDateTime);

      if (!admitDate || !dischargeDate) return "";

      const diffInMs = dischargeDate.getTime() - admitDate.getTime();
      const diffInDays = Math.round(diffInMs / (1000 * 60 * 60 * 24));

      return diffInDays >= 0 ? diffInDays.toString() : "";
    } catch {
      return "";
    }
  }

  private parseHl7Timestamp(timestamp: string): Date | null {
    if (!timestamp || timestamp.length < 8) return null;

    try {
      return buildDayjs(timestamp).toDate();
    } catch {
      return null;
    }
  }
}
