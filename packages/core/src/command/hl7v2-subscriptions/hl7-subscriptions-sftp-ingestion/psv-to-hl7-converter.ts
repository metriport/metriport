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
  private static readonly SENDING_APP = "HEALTHSHARE";
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

  // A01 (Admit/Visit): MSH | EVN | PID | PV1 | PV2 (O) | DG1 (O, ~) | NK1 (O, ~) | IN1/IN2/IN3 (O) | OBX/AL1/PR1/ROL/GT1 (O)
  // A03 (Discharge):  MSH | EVN | PID | PV1 | PV2 (O) | DG1 (O, ~) | NK1 (O, ~) | IN1/IN2/IN3 (O) | OBX/AL1/PR1/ROL/GT1 (O)
  // - A01: PV1-44 = Admit DT; PV1-45 = "" ; DG1-6 = "A" (Admitting) if used
  // - A03: PV1-44 = Admit DT; PV1-45 = Discharge DT; DG1-6 = "F" (Final) if known
  private buildMessageFromRow(row: Row): string {
    const triggerEvent = this.getTriggerEvent(row);
    const segments = [
      this.buildMshFromRow(row),
      this.buildEvnFromRow(row),
      this.buildPidFromRow(row),
      this.buildPv1FromRow(row, triggerEvent),
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
    fields[2] = this.escapeHl7Text(row.FacilityAbbrev || "UNKNOWN");
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

    const eventFacility = this.escapeHl7Text(row.FacilityAbbrev);

    // 1 Event Type Code | 2 Recorded DT | 3 Planned DT | 4 Reason | 5 Operator | 6 Event Occurred | 7 Event Facility
    const fields: string[] = [];
    fields[0] = eventCode; // EVN-1 Event Type Code
    fields[1] = recordedTs; // EVN-2 Recorded DT
    fields[5] = eventOccurredTs; // EVN-6 Event Occurred
    fields[6] = eventFacility; // EVN-7 Event Facility
    return this.joinFields("EVN", fields);
  }

  private buildPidFromRow(row: Row): string {
    const assigningAuthority = this.escapeHl7Text(row.FacilityAbbrev);

    // PID-3: Metriplex first, then MRN (no checks)
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

    // PID: 1 Set ID | 2 Patient ID (External ID) | 3 Patient Identifier List (CX~CX...) | 4 Alternate Patient ID | 5 Patient Name (XPN)
    // | 6 Mother's Maiden Name (XPN) | 7 Date/Time of Birth (TS) | 8 Sex | 9 Patient Alias (XPN) | 10 Race (CWE) | 11 Patient Address (XAD)
    // | 12 County Code | 13 Phone Number—Home (XTN) | 14 Phone Number—Business (XTN) | 15 Primary Language (CWE) | 16 Marital Status (CWE)
    // | 17 Religion (CWE) | 18 Patient Account Number (CX) | 19 SSN Number—Patient | 20 Driver's License Number (DLN) | 21 Mother's Identifier (CX)
    // | 22 Ethnic Group (CWE) | 23 Birth Place | 24 Multiple Birth Indicator | 25 Birth Order | 26 Citizenship (CWE) | 27 Veterans Military Status (CWE)
    // | 28 Nationality (CWE) | 29 Patient Death Date and Time (TS) | 30 Patient Death Indicator | 31 Identity Unknown Indicator
    // | 32 Identity Reliability Code | 33 Last Update Date/Time (TS) | 34 Last Update Facility (HD) | 35 Species Code (CWE) | 36 Breed Code (CWE)
    // | 37 Strain | 38 Production Class Code (CWE) | 39 Tribal Citizenship (CWE)
    const fields: string[] = [];
    fields[0] = "1"; // SetID
    fields[1] = this.escapeHl7Text(row.PatientID);
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

  private buildPv1FromRow(row: Row, triggerEvent: SUPPORTED_ADT): string {
    const fields = this.buildGeneralPv1FromRow(row);
    const admitTs = this.extractTimestamp(row.AdmitDateTime);
    const dischargeTs =
      triggerEvent === SUPPORTED_ADT.ADT_A03 ? this.extractTimestamp(row.DischargeDateTime) : "";

    fields[43] = admitTs; // PV1-44 Admit DT
    fields[44] = dischargeTs; // PV1-45 Discharge DT

    this.trimTrailingEmpty(fields);
    return this.joinFields("PV1", fields);
  }

  private buildGeneralPv1FromRow(row: Row): string[] {
    const fields: string[] = [];

    fields[0] = "1"; // PV1-1 Set ID
    fields[1] = this.escapeHl7Text(row.PatClass || "O"); // PV1-2 Patient Class
    fields[2] = this.buildPlFromFacility(row); // PV1-3 Assigned Patient Location
    fields[3] = this.isEmergency(row) ? "E" : "R"; // PV1-4 Admission Type
    fields[6] = this.buildXcnFromFullName(row.AttendingPhysicianName); // PV1-7 Attending Doctor
    fields[7] = this.buildXcnFromFullName(row.ReferringPhysicianName); // PV1-8 Referring Doctor
    fields[9] = this.isEmergency(row) ? "EMER" : ""; // PV1-10 Hospital Service
    fields[16] = this.buildXcnFromFullName(row.AdmittingPhysicianName); // PV1-17 Admitting Doctor
    fields[17] = this.escapeHl7Text(row.PatClass); // PV1-18 Patient Type
    fields[18] = this.buildVisitNumber(row.VisitNumber, row.SendingToSystem, "VN"); // PV1-19 Visit Number
    fields[38] = this.escapeHl7Text(row.FacilityAbbrev || row.FacilityName); // PV1-39 Servicing Facility

    return fields;
  }

  private buildPv2FromRow(row: Row): string {
    // PV2: 1 Prior Pending Location (PL) | 2 Accommodation Code (CWE) | 3 Admit Reason (CWE) | 4 Transfer Reason (CWE) | 5 Patient Valuables (ST)
    // | 6 Patient Valuables Location (ST) | 7 Visit User Code (CWE) | 8 Expected Admit Date/Time (DTM) | 9 Expected Discharge Date/Time (DTM)
    // | 10 Estimated Length of Inpatient Stay (NM) | 11 Actual Length of Inpatient Stay (NM) | 12 Visit Description (ST) | 13 Referral Source Code (XCN)
    // | 14 Previous Service Date (DT) | 15 Employment Illness Related Indicator (ID) | 16 Purge Status Code (CWE) | 17 Purge Status Date (DT)
    // | 18 Special Program Code (CWE) | 19 Retention Indicator (ID) | 20 Expected Number of Insurance Plans (NM) | 21 Visit Publicity Code (CWE)
    // | 22 Visit Protection Indicator (ID) | 23 Clinic Organization Name (XON) | 24 Patient Status Code (CWE) | 25 Visit Priority Code (CWE)
    // | 26 Previous Treatment Date (DT) | 27 Expected Discharge Disposition (CWE) | 28 Signature on File Date (DT) | 29 First Similar Illness Date (DT)
    // | 30 Patient Charge Adjustment Code (CWE) | 31 Recurring Service Code (CWE) | 32 Billing Media Code (ID) | 33 Expected Surgery Date and Time (DTM)
    // | 34 Military Partnership Code (ID) | 35 Military Non-Availability Code (ID) | 36 Newborn Baby Indicator (ID) | 37 Baby Detained Indicator (ID)
    // | 38 Mode of Arrival Code (CWE) | 39 Recreational Drug Use Code (CWE) | 40 Admission Level of Care Code (CWE) | 41 Precaution Code (CWE)
    // | 42 Patient Condition Code (CWE) | 43 Living Will Code (CWE) | 44 Organ Donor Code (CWE) | 45 Advance Directive Code (CWE)
    // | 46 Patient Status Effective Date (DT) | 47 Expected LOA Return Date/Time (DTM) | 48 Expected Pre-admission Testing Date/Time (DTM)
    // | 49 Notify Clergy Code (CWE) | 50 Advance Directive Last Verified Date (DT)

    const fields: string[] = [];

    const id = row.DiagnosisCode;
    const text = row.DiagnosisText || row.ChiefComplaint;
    const system = row.DiagnosisCodingSystem;
    fields[2] = this.buildCweSimple(id, text, system); // PV2-3 Admit Reason (CWE)
    fields[7] = this.toHl7Ts(row.AdmitDateTime); // PV2-8 Expected Admit Date/Time (DTM)
    fields[8] = this.toHl7Ts(row.DischargeDateTime); // PV2-9 Expected Discharge Date/Time (DTM)
    fields[11] = this.escapeHl7Text(row.ChiefComplaint); // PV2-12 Visit Description (ST)
    fields[22] = this.escapeHl7Text(row.FacilityName); // PV2-23 Clinic Organization Name (XON.1)
    fields[23] = this.buildCweSimple("", row.PatClass, ""); // PV2-24 Patient Status Code (CWE) — use PatClass as text
    fields[39] = this.buildCweSimple(row.EmergencySeverityLevel, "ESI triage level", "ESI"); // PV2-40 Admission Level of Care Code (CWE) — map ESI triage level if present

    return this.joinFields("PV2", fields);
  }

  private buildDg1FromRow(row: Row): string {
    // DG1: 1 Set ID | 2 Diagnosis Coding Method (deprecated) | 3 Diagnosis Code - DG1 (CWE) | 4 Diagnosis Description (ST)
    // | 5 Diagnosis Date/Time (TS) | 6 Diagnosis Type (IS) | 7 Major Diagnostic Category (CWE) | 8 DRG Category (CWE) | 9 DRG Approval Indicator (ID)
    // | 10 DRG Grouper Review Code (IS) | 11 Outlier Type (CWE) | 12 Outlier Days (NM) | 13 Outlier Cost (CP) | 14 Grouper Version And Type (ST)
    // | 15 Diagnosis Priority (NM) | 16 Diagnosing Clinician (XCN) | 17 Diagnosis Classification (IS) | 18 Confidential Indicator (ID)
    // | 19 Attestation Date/Time (TS) | 20 Diagnosis Identifier (EI) | 21 Diagnosis Action Code (ID)
    const trigger = this.getTriggerEvent(row);
    const fields: string[] = [];
    fields[0] = "1";
    fields[2] = this.buildCweSimple(
      row.DiagnosisCode,
      row.DiagnosisText || row.ChiefComplaint,
      row.DiagnosisCodingSystem
    ); // DG1-3
    fields[3] = this.escapeHl7Text(row.DiagnosisText); // DG1-4 (desc, optional)
    fields[4] = this.toHl7Ts(row.AdmitDateTime || row.DischargeDateTime); // DG1-5
    fields[5] = trigger === SUPPORTED_ADT.ADT_A01 ? "A" : "F"; // DG1-6 (Admitting vs Final)
    fields[14] = "1"; // DG1-15 Diagnosis Priority

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
    return (dateTime ?? "").replace(/\D+/g, "").slice(0, 14);
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

    return this.joinHl7Fields(["", last, first, middle], "^");
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
    return `${base}_${this.hl7Now()}`;
  }

  private escapeHl7Text(input?: string): string {
    if (!input) return "";
    return input
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
}
