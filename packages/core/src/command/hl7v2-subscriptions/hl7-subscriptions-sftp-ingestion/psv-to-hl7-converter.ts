import { buildDayjs } from "@metriport/shared/common/date";
import { MetriportError } from "@metriport/shared";
import { parse } from "csv-parse";
import { Hl7Message } from "@medplum/core";
import { getCxIdAndPatientIdOrFail } from "../hl7v2-to-fhir-conversion/shared";

type Row = {
  FacilityAbbrev: string;
  FacilityName: string;
  VisitNumber: string;
  PatientID: string;
  LastName: string;
  FirstName: string;
  MiddleName: string;
  StreetAddress: string;
  City: string;
  State: string;
  ZipCode: string;
  PrimaryPhoneNumber: string;
  SSN: string;
  PatientDateofBirth: string;
  Gender: string;
  MaritalStatus: string;
  AdmitDateTime: string;
  ChiefComplaint: string;
  DiagnosisCode: string;
  DiagnosisText: string;
  DiagnosisCodingSystem: string;
  AttendingPhysicianName: string;
  ReferringPhysicianName: string;
  AdmittingPhysicianName: string;
  SendingToSystem: string;
  MetriplexPatID: string;
  DischargeDateTime: string;
  EmergencySeverityLevel: string;
  PatClass: string;
};

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

    const rows: Row[] = await new Promise((resolve, reject) => {
      parse(
        text,
        {
          delimiter: PsvToHl7Converter.FIELD_SEPARATOR,
          columns: hasHeader ? true : expectedHeader.split(PsvToHl7Converter.FIELD_SEPARATOR),
          skip_empty_lines: true,
          bom: true,
          trim: true,
          relax_column_count: true,
        },
        //eslint-disable-next-line @typescript-eslint/no-explicit-any
        (err: any, records: Row[]) => {
          if (err) return reject(err);
          resolve(records.filter(r => Object.values(r).some(v => String(v ?? "").trim() !== "")));
        }
      );
    });
    // Optionally change the MetriplexPatID (cxId and patientId) here for testing.
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
    fields[0] = PsvToHl7Converter.ENCODING_CHARS;
    fields[1] = this.escapeHl7Text(PsvToHl7Converter.SENDING_APP);
    fields[2] = this.escapeHl7Text(row.FacilityName || row.FacilityAbbrev);
    fields[3] = this.escapeHl7Text(row.SendingToSystem || PsvToHl7Converter.DEFAULT_RECEIVING_APP);
    fields[4] = this.escapeHl7Text(row.SendingToSystem || PsvToHl7Converter.DEFAULT_RECEIVING_APP);
    fields[5] = this.getMessageTime(row);
    fields[7] = msh9;
    fields[8] = this.escapeHl7Text(this.getMessageControlId(row));
    fields[9] = PsvToHl7Converter.PROCESSING_ID;
    fields[10] = PsvToHl7Converter.HL7_VERSION;

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

    const recordedTs = this.getMessageTime(row);
    const eventOccurredTs =
      this.toHl7Ts(trigger === SUPPORTED_ADT.ADT_A03 ? row.DischargeDateTime : row.AdmitDateTime) ||
      recordedTs;

    const eventFacility = this.escapeHl7Text(row.FacilityName || row.FacilityAbbrev);

    const fields: string[] = [];
    fields[0] = eventCode;
    fields[1] = recordedTs;
    fields[5] = eventOccurredTs;
    fields[6] = eventFacility;
    return this.joinFields("EVN", fields);
  }

  private buildPidFromRow(row: Row): string {
    const assigningAuthority = this.escapeHl7Text(row.FacilityAbbrev);

    const pid3PtIdList = [
      `${this.escapeHl7Text(row.MetriplexPatID)}^^^${assigningAuthority}`,
      `${this.escapeHl7Text(row.PatientID)}^^^${assigningAuthority}`,
    ].join("~");

    const pid5Name = this.buildNameXpn(row.FirstName, row.MiddleName, row.LastName);
    const pid7Dob = this.formatHl7Dob(row.PatientDateofBirth);
    const pid8Sex = this.escapeHl7Text(row.Gender || "U");
    const pid11Addr = [
      this.escapeHl7Text(row.StreetAddress),
      "",
      this.escapeHl7Text(row.City),
      this.escapeHl7Text(row.State),
      this.escapeHl7Text(row.ZipCode),
    ].join("^");

    const phoneDigits = this.digitsOnly(row.PrimaryPhoneNumber);
    const pid13Phone = ["", "PRN", "PH", "", "", "", phoneDigits].join("^");
    const pid16Marital = this.escapeHl7Text(row.MaritalStatus);
    const pid19Ssn = this.escapeHl7Text(row.SSN);

    const fields: string[] = [];
    fields[0] = "1";
    fields[1] = this.escapeHl7Text(row.MetriplexPatID);
    fields[2] = pid3PtIdList;
    fields[4] = pid5Name;
    fields[6] = pid7Dob;
    fields[7] = pid8Sex;
    fields[10] = pid11Addr;
    fields[12] = pid13Phone;
    fields[15] = pid16Marital;
    fields[18] = pid19Ssn;

    return this.joinFields("PID", fields);
  }

  private buildPv1FromRow(row: Row): string {
    const triggerEvent = this.getTriggerEvent(row);
    const fields = this.buildGeneralPv1FromRow(row);
    const admitTs = this.extractTimestamp(row.AdmitDateTime);
    const dischargeTs =
      triggerEvent === SUPPORTED_ADT.ADT_A03 ? this.extractTimestamp(row.DischargeDateTime) : "";

    fields[43] = admitTs;
    fields[44] = dischargeTs;

    this.trimTrailingEmpty(fields);
    return this.joinFields("PV1", fields);
  }

  private buildGeneralPv1FromRow(row: Row): string[] {
    const fields: string[] = [];

    fields[0] = "1";
    fields[1] = this.escapeHl7Text(row.PatClass || "O");
    fields[2] = this.buildPlFromFacility(row);
    fields[3] = this.isEmergency(row) ? "E" : "R";
    fields[6] = this.buildXcnFromFullName(row.AttendingPhysicianName);
    fields[7] = this.buildXcnFromFullName(row.ReferringPhysicianName);
    fields[9] = this.isEmergency(row) ? "EMER" : "";
    fields[16] = this.buildXcnFromFullName(row.AdmittingPhysicianName);
    fields[17] = this.escapeHl7Text(row.PatClass);
    fields[18] = this.buildVisitNumber(row.VisitNumber, row.SendingToSystem, "VN");
    fields[38] = this.escapeHl7Text(row.FacilityAbbrev || row.FacilityName);

    return fields;
  }

  private buildPv2FromRow(row: Row): string {
    const fields: string[] = [];

    const id = row.DiagnosisCode;
    const text = row.DiagnosisText;
    const system = row.DiagnosisCodingSystem;
    fields[2] = this.buildCweSimple(id, text, system);
    fields[7] = this.toHl7Ts(row.AdmitDateTime);
    fields[8] = this.toHl7Ts(row.DischargeDateTime);
    fields[10] = this.calculateLengthOfStay(row.AdmitDateTime, row.DischargeDateTime);
    fields[11] = this.escapeHl7Text(row.ChiefComplaint);
    fields[22] = this.escapeHl7Text(row.FacilityName);
    fields[23] = this.buildCweSimple("", row.PatClass, "");
    fields[39] = this.buildCweSimple(row.EmergencySeverityLevel, "ESI triage level", "ESI");

    return this.joinFields("PV2", fields);
  }

  private buildDg1FromRow(row: Row): string {
    const trigger = this.getTriggerEvent(row);
    const fields: string[] = [];
    fields[0] = "1";

    fields[2] = this.buildCweSimple(
      row.DiagnosisCode,
      row.DiagnosisText,
      row.DiagnosisCodingSystem
    );
    fields[3] = this.escapeHl7Text(row.DiagnosisText);
    fields[4] = this.toHl7Ts(
      trigger === SUPPORTED_ADT.ADT_A01 ? row.AdmitDateTime : row.DischargeDateTime
    );
    fields[5] = trigger === SUPPORTED_ADT.ADT_A01 ? "A" : "F";
    fields[14] = "1";

    return this.joinFields("DG1", fields);
  }

  ///////////////////////////////////////
  //              HELPERS              //
  ///////////////////////////////////////

  private joinFields(name: string, fields: string[]): string {
    return `${name}${PsvToHl7Converter.FIELD_SEPARATOR}${fields.join(
      PsvToHl7Converter.FIELD_SEPARATOR
    )}`;
  }

  private extractTimestamp(dateTime?: string): string {
    return this.digitsOnly(dateTime).slice(0, 14);
  }

  private buildCweSimple(id?: string, text?: string, system?: string): string {
    return this.joinHl7Fields([id, text, system], "^");
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
    const facility = row.FacilityAbbrev || row.FacilityName;
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
      !!(row.EmergencySeverityLevel && row.EmergencySeverityLevel.trim()) || row.PatClass === "E"
    );
  }

  private formatHl7Dob(dateOfBirth?: string): string {
    if (!dateOfBirth) return "";

    const trimmedInput = dateOfBirth.trim();

    const hyphenatedYmdMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(trimmedInput);
    if (hyphenatedYmdMatch) {
      const year = hyphenatedYmdMatch[1] ?? "";
      const month = hyphenatedYmdMatch[2] ?? "";
      const day = hyphenatedYmdMatch[3] ?? "";
      if (year && month && day) return `${year}${month}${day}`;
    }

    const slashedDateMatch = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(trimmedInput);
    if (slashedDateMatch) {
      const firstPart = slashedDateMatch[1] ?? "";
      const secondPart = slashedDateMatch[2] ?? "";
      const year = slashedDateMatch[3] ?? "";
      if (firstPart && secondPart && year) {
        const firstNumber = parseInt(firstPart, 10);
        const secondNumber = parseInt(secondPart, 10);
        const monthNumber = firstNumber > 12 ? secondNumber : firstNumber;
        const dayNumber = firstNumber > 12 ? firstNumber : secondNumber;
        const month = String(monthNumber).padStart(2, "0");
        const day = String(dayNumber).padStart(2, "0");
        return `${year}${month}${day}`;
      }
    }

    const digitsOnly = trimmedInput.replace(/\D+/g, "");
    if (digitsOnly.length >= 8) return digitsOnly.slice(0, 8);
    if (digitsOnly.length === 6) return digitsOnly;
    if (digitsOnly.length === 4) return digitsOnly;

    return "";
  }

  private trimTrailingEmpty(parts: string[]): void {
    let i = parts.length - 1;
    while (i >= 0 && parts[i] === "") i--;
    parts.length = i + 1;
  }

  private hl7Now(): string {
    return buildDayjs(Date.now()).utc().format("YYYYMMDDHHmmss");
  }

  private getMessageControlId(row: Row): string {
    const base = row.VisitNumber || row.PatientID || row.MetriplexPatID || "NA";
    const timestamp = this.toHl7Ts(row.AdmitDateTime) || this.hl7Now();
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
    if (row.DischargeDateTime) {
      return SUPPORTED_ADT.ADT_A03;
    } else {
      return SUPPORTED_ADT.ADT_A01;
    }
  }

  private getMessageTime(row: Row): string {
    return (
      this.toHl7Ts(row.AdmitDateTime) ||
      this.toHl7Ts(row.DischargeDateTime) ||
      this.toHl7Ts(buildDayjs(Date.now()).toISOString())
    );
  }

  private digitsOnly(s?: string): string {
    return (s ?? "").replace(/\D+/g, "");
  }

  private toHl7Ts(s?: string): string {
    if (!s) return "";
    const d = this.digitsOnly(s);
    if (d.length >= 14) return d.slice(0, 14);
    if (d.length === 12) return d + "00";
    if (d.length === 10) return d + "00";
    if (d.length === 8) return d;
    if (d.length === 6) return "20" + d;
    return d;
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
      const year = parseInt(timestamp.substring(0, 4), 10);
      const month = parseInt(timestamp.substring(4, 6), 10) - 1;
      const day = parseInt(timestamp.substring(6, 8), 10);
      const hour = timestamp.length >= 10 ? parseInt(timestamp.substring(8, 10), 10) : 0;
      const minute = timestamp.length >= 12 ? parseInt(timestamp.substring(10, 12), 10) : 0;
      const second = timestamp.length >= 14 ? parseInt(timestamp.substring(12, 14), 10) : 0;

      return new Date(year, month, day, hour, minute, second);
    } catch {
      return null;
    }
  }
}
