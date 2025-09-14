import { PsvToHl7Converter } from "../psv-to-hl7-converter";
import { compressUuid } from "../../hl7v2-subscriptions/hl7v2-to-fhir-conversion/shared";
import * as configModule from "../../../util/config";

describe("PsvToHl7Converter", () => {
  beforeAll(() => {
    jest.spyOn(configModule.Config, "getHl7Base64ScramblerSeed").mockReturnValue("unit-test-seed");
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  const TEST_CX_ID_1 = "550e8400-e29b-41d4-a716-446655440001";
  const TEST_PT_ID_1 = "550e8400-e29b-41d4-a716-446655440002";
  const TEST_CX_ID_2 = "550e8400-e29b-41d4-a716-446655440003";
  const TEST_PT_ID_2 = "550e8400-e29b-41d4-a716-446655440004";

  const FACILITY_NAME = "Test Hospital";
  const FACILITY_ABBREV = "HOSP";
  const FACILITY_RECEIVING_APP = "METRIPORT";
  const FACILITY_SENDING_APP = "LAHIESFTP";

  const ADMIT_DATETIME = "20240115120000";
  const PATIENT_ID = "PAT001";
  const METRIPLEX_PAT_ID = "PLACEHOLDER_METRIPLEX_PAT_ID";
  const PATIENT_NAME_LAST = "Smith";
  const PATIENT_NAME_FIRST = "John";
  const PATIENT_NAME_MIDDLE = "Michael";
  const PATIENT_DOB = "19900115";
  const PATIENT_GENDER = "M";
  const PATIENT_ADDRESS_LINE = "123 Main St";
  const PATIENT_ADDRESS_CITY = "Anytown";
  const PATIENT_ADDRESS_STATE = "CA";
  const PATIENT_ADDRESS_ZIP = "12345";
  const PATIENT_ADDRESS = `${PATIENT_ADDRESS_LINE}^^${PATIENT_ADDRESS_CITY}^${PATIENT_ADDRESS_STATE}^${PATIENT_ADDRESS_ZIP}`;
  const PATIENT_PHONE = "^PRN^PH^^^^5551234";
  const PATIENT_MARITAL_STATUS = "S";
  const PATIENT_SSN = "123-45-6789";
  const VISIT_NUMBER = "VN123";
  const PATIENT_CLASS = "I";
  const EMERGENCY_SEVERITY_LEVEL = "3";
  const ATTENDING_PHYSICIAN = "Dr. Johnson, Robert";
  const REFERRING_PHYSICIAN = "Dr. Williams, Sarah";
  const ADMITTING_PHYSICIAN = "Dr. Brown, David";
  const DIAGNOSIS_CODE = "I21.9";
  const DIAGNOSIS_TEXT = "Acute myocardial infarction";
  const DIAGNOSIS_SYSTEM = "ICD-10";
  const CHIEF_COMPLAINT = "Chest pain";
  const ESI_TRIAGE_LEVEL = "ESI triage level";
  const ESI_SYSTEM = "ESI";

  const PATIENT2_ID = "PAT002";
  const PATIENT2_METRIPLEX_PAT_ID = "PLACEHOLDER_PATIENT2_METRIPLEX_PAT_ID";
  const PATIENT2_NAME_LAST = "Doe";
  const PATIENT2_NAME_FIRST = "Jane";
  const PATIENT2_CLASS = "2";
  const PATIENT2_EMERGENCY_SEVERITY_LEVEL = "2";
  const PATIENT2_ATTENDING_PHYSICIAN = "Dr. Davis, Lisa";
  const PATIENT2_REFERRING_PHYSICIAN = "Dr. Wilson, Mark";
  const PATIENT2_ADMITTING_PHYSICIAN = "Dr. Taylor, Chris";
  const PATIENT2_VISIT_NUMBER = "VN124";
  const PATIENT2_ADMIT_DATETIME = "20240115140000";
  const PATIENT2_DISCHARGE_DATETIME = "20240116120000";

  const PATIENT2_DIAGNOSIS_CODE = "R50.9";
  const PATIENT2_DIAGNOSIS_TEXT = "Fever, unspecified";
  const PATIENT2_DIAGNOSIS_SYSTEM = "ICD-10";
  const PATIENT2_DIAGNOSIS_CWE = `${PATIENT2_DIAGNOSIS_CODE}^${PATIENT2_DIAGNOSIS_TEXT}^${PATIENT2_DIAGNOSIS_SYSTEM}`;
  const PATIENT2_CHIEF_COMPLAINT = "Fever";
  const psvData = `FacilityAbbrev|FacilityName|VisitNumber|PatientID|LastName|FirstName|MiddleName|StreetAddress|City|State|ZipCode|PrimaryPhoneNumber|SSN|PatientDateofBirth|Gender|MaritalStatus|AdmitDateTime|ChiefComplaint|DiagnosisCode|DiagnosisText|DiagnosisCodingSystem|AttendingPhysicianName|ReferringPhysicianName|AdmittingPhysicianName|SendingToSystem|MetriplexPatID|DischargeDateTime|EmergencySeverityLevel|PatClass
    ${FACILITY_ABBREV}|${FACILITY_NAME}|${VISIT_NUMBER}|${PATIENT_ID}|${PATIENT_NAME_LAST}|${PATIENT_NAME_FIRST}|${PATIENT_NAME_MIDDLE}|${PATIENT_ADDRESS_LINE}|${PATIENT_ADDRESS_CITY}|${PATIENT_ADDRESS_STATE}|${PATIENT_ADDRESS_ZIP}|555-1234|${PATIENT_SSN}|1990-01-15|${PATIENT_GENDER}|${PATIENT_MARITAL_STATUS}|${ADMIT_DATETIME}|${CHIEF_COMPLAINT}|${DIAGNOSIS_CODE}|${DIAGNOSIS_TEXT}|${DIAGNOSIS_SYSTEM}|${ATTENDING_PHYSICIAN}|${REFERRING_PHYSICIAN}|${ADMITTING_PHYSICIAN}|${FACILITY_RECEIVING_APP}|${METRIPLEX_PAT_ID}||${EMERGENCY_SEVERITY_LEVEL}|${PATIENT_CLASS}
    ${FACILITY_ABBREV}|${FACILITY_NAME}|${PATIENT2_VISIT_NUMBER}|${PATIENT2_ID}|${PATIENT2_NAME_LAST}|${PATIENT2_NAME_FIRST}||456 Oak Ave|Somewhere|NY|67890|555-5678|987-65-4321|1985-05-20|F|M|${PATIENT2_ADMIT_DATETIME}|${PATIENT2_CHIEF_COMPLAINT}|${PATIENT2_DIAGNOSIS_CODE}|${PATIENT2_DIAGNOSIS_TEXT}|${PATIENT2_DIAGNOSIS_SYSTEM}|${PATIENT2_ATTENDING_PHYSICIAN}|${PATIENT2_REFERRING_PHYSICIAN}|${PATIENT2_ADMITTING_PHYSICIAN}|${FACILITY_RECEIVING_APP}|${PATIENT2_METRIPLEX_PAT_ID}|${PATIENT2_DISCHARGE_DATETIME}|${PATIENT2_EMERGENCY_SEVERITY_LEVEL}|${PATIENT2_CLASS}`;

  it("should convert the MSH fields correctly", async () => {
    const converter = new PsvToHl7Converter(Buffer.from(psvData, "utf8"));
    const hl7Messages = await converter.getHl7Messages();

    const firstMessage = hl7Messages[0];
    expect(firstMessage).toBeDefined();
    if (!firstMessage) {
      throw new Error("Programmer error");
    }

    const mshSegment = firstMessage.getSegment("MSH");
    expect(mshSegment).toBeDefined();
    if (!mshSegment) {
      throw new Error("Programmer error");
    }

    //1st part of MSH is the field separator
    const FIELD_SEPARATOR = "|";
    expect(mshSegment.getField(1).toString()).toBe(FIELD_SEPARATOR);

    //2nd part of MSH is the encoding characters
    const ENCODING_CHARS = "^~\\&";
    expect(mshSegment.getField(2).toString()).toBe(ENCODING_CHARS);

    //3rd part of MSH is the sending application we expect this to be "LAHIESFTP"
    expect(mshSegment.getField(3).toString()).toBe(FACILITY_SENDING_APP);

    //4th part of MSH is the sending facility. We expect this to be the NAME of the facility. In this case "Test Hospital"
    expect(mshSegment.getField(4).toString()).toBe(FACILITY_NAME);

    //5th part of MSH is the receiving application. We expect this to be "METRIPORT"
    expect(mshSegment.getField(5).toString()).toBe(FACILITY_RECEIVING_APP);

    //Skip 6th (recieving facility)
    expect(mshSegment.getField(6).toString()).toBe(FACILITY_RECEIVING_APP);

    //7th part of MSH is the datetime of the message.
    expect(mshSegment.getField(7).toString()).toBe(ADMIT_DATETIME);

    //9th part of MSH is the message type.
    const field9 = mshSegment.getField(9);
    expect(field9).toBeDefined();
    if (!field9 || !field9.components || !field9.components[0]) {
      throw new Error("Programmer error");
    }
    const MESSAGE_TYPE_ADT = "ADT";
    const MESSAGE_CODE_A01 = "A01";
    const MESSAGE_STRUCTURE_ADT_A01 = "ADT_A01";
    expect(field9.components[0][0]).toBe(MESSAGE_TYPE_ADT);
    expect(field9.components[0][1]).toBe(MESSAGE_CODE_A01);
    expect(field9.components[0][2]).toBe(MESSAGE_STRUCTURE_ADT_A01);

    //10th part of MSH is the message control id.
    expect(mshSegment.getField(10).toString()).toBe(`VN123_${ADMIT_DATETIME}`);

    //11th part of MSH is the processing id.
    const PROCESSING_ID_PRODUCTION = "P";
    expect(mshSegment.getField(11).toString()).toBe(PROCESSING_ID_PRODUCTION);

    //12 part of MSH is the version. We expect this to be "2.5.1"
    const HL7_VERSION = "2.5.1";
    expect(mshSegment.getField(12).toString()).toBe(HL7_VERSION);
  });

  it("should convert the EVN fields correctly", async () => {
    const converter = new PsvToHl7Converter(Buffer.from(psvData, "utf8"));
    const hl7Messages = await converter.getHl7Messages();
    const firstMessage = hl7Messages[0];
    expect(firstMessage).toBeDefined();
    if (!firstMessage) {
      throw new Error("Programmer error");
    }
    const evnSegment = firstMessage.getSegment("EVN");
    expect(evnSegment).toBeDefined();
    if (!evnSegment) {
      throw new Error("Programmer error");
    }

    //1st part of EVN is the event type code.
    const EVENT_TYPE_CODE_A01 = "A01";
    expect(evnSegment.getField(1).toString()).toBe(EVENT_TYPE_CODE_A01);

    //2nd part of EVN is the recorded datetime.
    expect(evnSegment.getField(2).toString()).toBe(ADMIT_DATETIME);

    //6th part of EVN is the event occurred.
    expect(evnSegment.getField(6).toString()).toBe(ADMIT_DATETIME);

    //7th part of EVN is the event facility.
    expect(evnSegment.getField(7).toString()).toBe(FACILITY_NAME);
  });

  it("should convert the PID fields correctly", async () => {
    const converter = new PsvToHl7Converter(Buffer.from(psvData, "utf8"));
    const hl7Messages = await converter.getHl7Messages();
    const firstMessage = hl7Messages[0];
    expect(firstMessage).toBeDefined();
    if (!firstMessage) {
      throw new Error("Programmer error");
    }
    const pidSegment = firstMessage.getSegment("PID");
    expect(pidSegment).toBeDefined();
    if (!pidSegment) {
      throw new Error("Programmer error");
    }

    //1st part of PID is the set id.
    const PID_SET_ID = "1";
    expect(pidSegment.getField(1).toString()).toBe(PID_SET_ID);

    //2nd part of PID is the patient id. We expect this to be MetriplexPatID (primary identifier)
    expect(pidSegment.getField(2).toString()).toBe(METRIPLEX_PAT_ID);

    //3rd part of PID is the patient identifier list.
    expect(pidSegment.getField(3).toString()).toBe(
      `${METRIPLEX_PAT_ID}^^^${FACILITY_ABBREV}~${PATIENT_ID}^^^${FACILITY_ABBREV}`
    );

    //4th part of PID is the alternate patient id.
    expect(pidSegment.getField(4).toString()).toBe("");

    //5th part of PID is the patient name.
    expect(pidSegment.getField(5).toString()).toBe(
      `${PATIENT_NAME_LAST}^${PATIENT_NAME_FIRST}^${PATIENT_NAME_MIDDLE}`
    );

    //7th part of PID is the date/time of birth.
    expect(pidSegment.getField(7).toString()).toBe(PATIENT_DOB);

    //8th part of PID is the sex.
    expect(pidSegment.getField(8).toString()).toBe(PATIENT_GENDER);

    //11th part of PID is the patient address.
    expect(pidSegment.getField(11).toString()).toBe(PATIENT_ADDRESS);

    //13th part of PID is the phone number-home.
    expect(pidSegment.getField(13).toString()).toBe(PATIENT_PHONE);

    //16th part of PID is the marital status.
    expect(pidSegment.getField(16).toString()).toBe(PATIENT_MARITAL_STATUS);

    //19th part of PID is the SSN number.
    expect(pidSegment.getField(19).toString()).toBe(PATIENT_SSN);
  });

  const PV1_SET_ID = "1";
  const ADMISSION_TYPE_EMERGENCY = "E";
  const HOSPITAL_SERVICE_EMERGENCY = "EMER";
  it("should convert the PV1 fields correctly for ADT_A01 (admission)", async () => {
    const converter = new PsvToHl7Converter(Buffer.from(psvData, "utf8"));
    const hl7Messages = await converter.getHl7Messages();

    expect(hl7Messages).toHaveLength(2);

    const admissionMessage = hl7Messages[0];
    expect(admissionMessage).toBeDefined();
    if (!admissionMessage) {
      throw new Error("Programmer error");
    }
    const admissionPv1Segment = admissionMessage.getSegment("PV1");
    expect(admissionPv1Segment).toBeDefined();
    if (!admissionPv1Segment) {
      throw new Error("Programmer error");
    }

    //1st part of PV1 is the set id.
    expect(admissionPv1Segment.getField(1).toString()).toBe(PV1_SET_ID);

    //2nd part of PV1 is the patient class.
    expect(admissionPv1Segment.getField(2).toString()).toBe(PATIENT_CLASS);

    //3rd part of PV1 is the assigned patient location.
    expect(admissionPv1Segment.getField(3).toString()).toBe(`^^^${FACILITY_ABBREV}`);

    //4th part of PV1 is the admission type.
    expect(admissionPv1Segment.getField(4).toString()).toBe(ADMISSION_TYPE_EMERGENCY);

    //7th part of PV1 is the attending doctor.
    const ATTENDING_PHYSICIAN_PARSED = "^Johnson^Robert^^^Dr.";
    expect(admissionPv1Segment.getField(7).toString()).toBe(ATTENDING_PHYSICIAN_PARSED);

    //8th part of PV1 is the referring doctor.

    const REFERRING_PHYSICIAN_PARSED = "^Williams^Sarah^^^Dr.";
    expect(admissionPv1Segment.getField(8).toString()).toBe(REFERRING_PHYSICIAN_PARSED);

    //10th part of PV1 is the hospital service
    expect(admissionPv1Segment.getField(10).toString()).toBe(HOSPITAL_SERVICE_EMERGENCY);

    //17th part of PV1 is the admitting doctor.
    const ADMITTING_PHYSICIAN_PARSED = "^Brown^David^^^Dr.";
    expect(admissionPv1Segment.getField(17).toString()).toBe(ADMITTING_PHYSICIAN_PARSED);

    //18th part of PV1 is the patient type.
    expect(admissionPv1Segment.getField(18).toString()).toBe(PATIENT_CLASS);

    //19th part of PV1 is the visit number.
    expect(admissionPv1Segment.getField(19).toString()).toBe(
      `${VISIT_NUMBER}^^^${FACILITY_RECEIVING_APP}^VN`
    );

    //39th part of PV1 is the servicing facility.
    expect(admissionPv1Segment.getField(39).toString()).toBe(FACILITY_ABBREV);

    //44th part of PV1 is the admit date/time
    expect(admissionPv1Segment.getField(44).toString()).toBe(ADMIT_DATETIME);
  });

  it("should convert the PV1 fields correctly for ADT_A03 (discharge)", async () => {
    const converter = new PsvToHl7Converter(Buffer.from(psvData, "utf8"));
    const hl7Messages = await converter.getHl7Messages();

    expect(hl7Messages).toHaveLength(2);

    const dischargeMessage = hl7Messages[1];
    expect(dischargeMessage).toBeDefined();
    if (!dischargeMessage) {
      throw new Error("Programmer error");
    }
    const dischargePv1Segment = dischargeMessage.getSegment("PV1");
    expect(dischargePv1Segment).toBeDefined();
    if (!dischargePv1Segment) {
      throw new Error("Programmer error");
    }

    //1st part of PV1 is the set id.
    expect(dischargePv1Segment.getField(1).toString()).toBe(PV1_SET_ID);

    //2nd part of PV1 is the patient class.
    expect(dischargePv1Segment.getField(2).toString()).toBe(PATIENT2_CLASS);

    //3rd part of PV1 is the assigned patient location.
    expect(dischargePv1Segment.getField(3).toString()).toBe(`^^^${FACILITY_ABBREV}`);

    //4th part of PV1 is the admission type.
    expect(dischargePv1Segment.getField(4).toString()).toBe(ADMISSION_TYPE_EMERGENCY);

    //7th part of PV1 is the attending doctor.
    const PATIENT2_ATTENDING_PHYSICIAN_PARSED = "^Davis^Lisa^^^Dr.";
    expect(dischargePv1Segment.getField(7).toString()).toBe(PATIENT2_ATTENDING_PHYSICIAN_PARSED);

    //8th part of PV1 is the referring doctor.
    const PATIENT2_REFERRING_PHYSICIAN_PARSED = "^Wilson^Mark^^^Dr.";
    expect(dischargePv1Segment.getField(8).toString()).toBe(PATIENT2_REFERRING_PHYSICIAN_PARSED);

    //10th part of PV1 is the hospital service
    expect(dischargePv1Segment.getField(10).toString()).toBe(HOSPITAL_SERVICE_EMERGENCY);

    //17th part of PV1 is the admitting doctor.
    const PATIENT2_ADMITTING_PHYSICIAN_PARSED = "^Taylor^Chris^^^Dr.";
    expect(dischargePv1Segment.getField(17).toString()).toBe(PATIENT2_ADMITTING_PHYSICIAN_PARSED);

    //18th part of PV1 is the patient type.
    expect(dischargePv1Segment.getField(18).toString()).toBe(PATIENT2_CLASS);

    //19th part of PV1 is the visit number.
    expect(dischargePv1Segment.getField(19).toString()).toBe(
      `${PATIENT2_VISIT_NUMBER}^^^${FACILITY_RECEIVING_APP}^VN`
    );

    //39th part of PV1 is the servicing facility.
    expect(dischargePv1Segment.getField(39).toString()).toBe(FACILITY_ABBREV);

    //44th part of PV1 is the admit date/time
    expect(dischargePv1Segment.getField(44).toString()).toBe(PATIENT2_ADMIT_DATETIME);

    //45th part of PV1 is the discharge date/time (populated for ADT_A03)
    expect(dischargePv1Segment.getField(45).toString()).toBe(PATIENT2_DISCHARGE_DATETIME);
  });

  const DIAGNOSIS_CWE = `${DIAGNOSIS_CODE}^${DIAGNOSIS_TEXT}^${DIAGNOSIS_SYSTEM}`;
  it("should convert the PV2 fields correctly", async () => {
    const converter = new PsvToHl7Converter(Buffer.from(psvData, "utf8"));
    const hl7Messages = await converter.getHl7Messages();
    const firstMessage = hl7Messages[0];
    expect(firstMessage).toBeDefined();
    if (!firstMessage) {
      throw new Error("Programmer error");
    }
    const pv2Segment = firstMessage.getSegment("PV2");
    expect(pv2Segment).toBeDefined();
    if (!pv2Segment) {
      throw new Error("Programmer error");
    }

    //PV2.3 - Admit Reason
    expect(pv2Segment.getField(3).toString()).toBe(DIAGNOSIS_CWE);

    //PV2.8 - Expected Admit Date/Time
    expect(pv2Segment.getField(8).toString()).toBe(ADMIT_DATETIME);

    //PV2.11 - Actual Length of Inpatient Stay (should be empty for ADT_A01 since no discharge date)
    const EXPECTED_LENGTH_OF_STAY_ADT_A01 = "";
    expect(pv2Segment.getField(11).toString()).toBe(EXPECTED_LENGTH_OF_STAY_ADT_A01);

    //PV2.12 - Visit Description
    expect(pv2Segment.getField(12).toString()).toBe(CHIEF_COMPLAINT);

    //PV2.23 - Clinic Organization Name
    expect(pv2Segment.getField(23).toString()).toBe(FACILITY_NAME);

    //PV2.24 - Patient Status Code
    expect(pv2Segment.getField(24).toString()).toBe(PATIENT_CLASS);

    //PV2.40 - Admission Level of Care Code
    const ADMISSION_LEVEL_OF_CARE_CWE = `${EMERGENCY_SEVERITY_LEVEL}^${ESI_TRIAGE_LEVEL}^${ESI_SYSTEM}`;
    expect(pv2Segment.getField(40).toString()).toBe(ADMISSION_LEVEL_OF_CARE_CWE);
  });

  it("should calculate PV2-11 length of stay correctly for ADT_A03", async () => {
    const converter = new PsvToHl7Converter(Buffer.from(psvData, "utf8"));
    const hl7Messages = await converter.getHl7Messages();
    const dischargeMessage = hl7Messages[1];
    expect(dischargeMessage).toBeDefined();
    if (!dischargeMessage) {
      throw new Error("Programmer error");
    }
    const dischargePv2Segment = dischargeMessage.getSegment("PV2");
    expect(dischargePv2Segment).toBeDefined();
    if (!dischargePv2Segment) {
      throw new Error("Programmer error");
    }

    // PV2.11 - Actual Length of Inpatient Stay
    const EXPECTED_LENGTH_OF_STAY_ADT_A03 = "1";
    expect(dischargePv2Segment.getField(11).toString()).toBe(EXPECTED_LENGTH_OF_STAY_ADT_A03);
  });

  const DG1_SET_ID = "1";
  const PRIMARY_DIAGNOSIS_PRIORITY = "1";
  it("should convert the DG1 fields correctly", async () => {
    const converter = new PsvToHl7Converter(Buffer.from(psvData, "utf8"));
    const hl7Messages = await converter.getHl7Messages();
    const firstMessage = hl7Messages[0];
    expect(firstMessage).toBeDefined();
    if (!firstMessage) {
      throw new Error("Programmer error");
    }
    const dg1Segment = firstMessage.getSegment("DG1");
    expect(dg1Segment).toBeDefined();
    if (!dg1Segment) {
      throw new Error("Programmer error");
    }

    //DG1.1 - Set ID - DG1 (should be "1")
    expect(dg1Segment.getField(1).toString()).toBe(DG1_SET_ID);

    //DG1.3 - Diagnosis Code - DG1
    expect(dg1Segment.getField(3).toString()).toBe(DIAGNOSIS_CWE);

    //DG1.4 - Diagnosis Description
    expect(dg1Segment.getField(4).toString()).toBe(DIAGNOSIS_TEXT);

    //DG1.5 - Diagnosis Date/Time
    expect(dg1Segment.getField(5).toString()).toBe(ADMIT_DATETIME);

    //DG1.6 - Diagnosis Type
    const ADMITTING_DIAGNOSIS_TYPE = "A";
    expect(dg1Segment.getField(6).toString()).toBe(ADMITTING_DIAGNOSIS_TYPE);

    //DG1.15 - Diagnosis Priority
    expect(dg1Segment.getField(15).toString()).toBe(PRIMARY_DIAGNOSIS_PRIORITY);
  });

  it("should convert the DG1 fields correctly for ADT_A03 (discharge)", async () => {
    const converter = new PsvToHl7Converter(Buffer.from(psvData, "utf8"));
    const hl7Messages = await converter.getHl7Messages();
    const secondMessage = hl7Messages[1];
    expect(secondMessage).toBeDefined();
    if (!secondMessage) {
      throw new Error("Programmer error");
    }
    const dg1Segment = secondMessage.getSegment("DG1");
    expect(dg1Segment).toBeDefined();
    if (!dg1Segment) {
      throw new Error("Programmer error");
    }

    //DG1.1 - Set ID - DG1
    expect(dg1Segment.getField(1).toString()).toBe(DG1_SET_ID);

    //DG1.3 - Diagnosis Code - DG1
    expect(dg1Segment.getField(3).toString()).toBe(PATIENT2_DIAGNOSIS_CWE);

    //DG1.4 - Diagnosis Description
    expect(dg1Segment.getField(4).toString()).toBe(PATIENT2_DIAGNOSIS_TEXT);

    //DG1.5 - Diagnosis Date/Time
    expect(dg1Segment.getField(5).toString()).toBe(PATIENT2_DISCHARGE_DATETIME);

    //DG1.6 - Diagnosis Type
    const FINAL_DIAGNOSIS_TYPE = "F";
    expect(dg1Segment.getField(6).toString()).toBe(FINAL_DIAGNOSIS_TYPE);

    //DG1.15 - Diagnosis Priority
    expect(dg1Segment.getField(15).toString()).toBe(PRIMARY_DIAGNOSIS_PRIORITY);
  });

  it("should correctly build all segments", async () => {
    const metriplexPatIdCompressed = `${compressUuid(TEST_CX_ID_1)}_${compressUuid(TEST_PT_ID_1)}`;
    const patient2MetriplexPatIdCompressed = `${compressUuid(TEST_CX_ID_2)}_${compressUuid(
      TEST_PT_ID_2
    )}`;

    const testPsvData = psvData
      .replace(METRIPLEX_PAT_ID, metriplexPatIdCompressed)
      .replace(PATIENT2_METRIPLEX_PAT_ID, patient2MetriplexPatIdCompressed);

    const converter = new PsvToHl7Converter(Buffer.from(testPsvData, "utf8"));
    const identifiedMessages = await converter.getIdentifiedHl7Messages();

    expect(identifiedMessages).toHaveLength(2);

    const firstMessage = identifiedMessages[0];
    expect(firstMessage).toBeDefined();
    if (!firstMessage) {
      throw new Error("Programmer error");
    }

    expect(firstMessage.hl7Message.getSegment("MSH")).toBeDefined();
    expect(firstMessage.hl7Message.getSegment("EVN")).toBeDefined();
    expect(firstMessage.hl7Message.getSegment("PID")).toBeDefined();
    expect(firstMessage.hl7Message.getSegment("PV1")).toBeDefined();
    expect(firstMessage.hl7Message.getSegment("PV2")).toBeDefined();
    expect(firstMessage.hl7Message.getSegment("DG1")).toBeDefined();

    expect(firstMessage.cxId).toBe(TEST_CX_ID_1);
    expect(firstMessage.ptId).toBe(TEST_PT_ID_1);

    const secondMessage = identifiedMessages[1];
    expect(secondMessage).toBeDefined();
    if (!secondMessage) {
      throw new Error("Programmer error");
    }

    expect(secondMessage.hl7Message.getSegment("MSH")).toBeDefined();
    expect(secondMessage.hl7Message.getSegment("EVN")).toBeDefined();
    expect(secondMessage.hl7Message.getSegment("PID")).toBeDefined();
    expect(secondMessage.hl7Message.getSegment("PV1")).toBeDefined();
    expect(secondMessage.hl7Message.getSegment("PV2")).toBeDefined();
    expect(secondMessage.hl7Message.getSegment("DG1")).toBeDefined();

    expect(secondMessage.cxId).toBe(TEST_CX_ID_2);
    expect(secondMessage.ptId).toBe(TEST_PT_ID_2);
  });
});
