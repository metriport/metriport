var parameterList = new XMLList();

/*
For document searches on the NHIN, it is recommended to use the following elements as the primary search parameters:
 * Patient ID
 * Class code
 * Practice Setting Code
 * Healthcare Facility Type
 * Document Creation Time 
*/

const baseLogMessage = "XCPD ITI38 Processor - requestId: " + msg.id.toString() + ", " + "cxId: " + msg.cxId.toString() + " - ";


// XDSDocumentEntryPatientId (REQUIRED) [1..1]
// Dec 20: xcpdPatientId to gatewayPatientId
var patientEntry = getXDSDocumentEntryPatientId(
  msg.externalGatewayPatient.id.toString(),
  msg.externalGatewayPatient.system.toString()
);
if (patientEntry) parameterList += patientEntry;

// XDSDocumentEntryStatus (REQUIRED) [1..*]
var docStatus = getXDSDocumentEntryStatus();
if (docStatus) parameterList += docStatus;

// XDSDocumentEntryClassCode (OPTIONAL) [0..*]
if (msg.hasOwnProperty("classCode") && msg.classCode.length > 0) {
  var docClassCode = getXDSDocumentEntryClassCode(msg.classCode);
  if (docClassCode) parameterList += docClassCode;
}

// XDSDocumentEntryPracticeSettingCode (OPTIONAL - RECOMMENDED) [0..*]
if (msg.hasOwnProperty("practiceSettingCode") && msg.practiceSettingCode.length > 0) {
  var practiceSetting = getXDSDocumentEntryPracticeSettingCode(msg.practiceSettingCode);
  if (practiceSetting) parameterList += practiceSetting;
}

// XDSDocumentEntryHealthcareFacilityTypeCode (OPTIONAL - RECOMMENDED) [0..*]
if (msg.hasOwnProperty("facilityTypeCode") && msg.facilityTypeCode.length > 0) {
  var facilityCode = getXDSDocumentEntryHealthcareFacilityTypeCode(msg.facilityTypeCode);
  if (facilityCode) parameterList += facilityCode;
}

// XDSDocumentEntryCreationTimeFrom (OPTIONAL - RECOMMENDED) [0..1]
// XDSDocumentEntryCreationTimeTo (OPTIONAL - RECOMMENDED) [0..1]
if (msg.hasOwnProperty("documentCreationDate")) {
  if (msg.documentCreationDate.hasOwnProperty("dateFrom")) {
    var dateFrom = getXDSDocumentEntryCreationTimeFrom(
      msg.documentCreationDate.dateFrom.toString()
    );
    if (dateFrom) parameterList += dateFrom;
  }

  if (msg.documentCreationDate.hasOwnProperty("dateTo")) {
    var dateTo = getXDSDocumentEntryCreationTimeTo(msg.documentCreationDate.dateTo.toString());
    if (dateTo) parameterList += dateTo;
  }
}

// XDSDocumentEntryServiceStartTimeFrom (OPTIONAL) [0..1]
// XDSDocumentEntryServiceStartTimeTo (OPTIONAL) [0..1]
if (msg.hasOwnProperty("serviceDate")) {
  if (msg.serviceDate.hasOwnProperty("dateFrom")) {
    var serviceFrom = getXDSDocumentEntryServiceStartTimeFrom(msg.serviceDate.dateFrom.toString());
    if (serviceFrom) parameterList += serviceFrom;
  }

  if (msg.serviceDate.hasOwnProperty("dateTo")) {
    var serviceTo = getXDSDocumentEntryServiceStartTimeTo(msg.serviceDate.dateTo.toString());
    if (serviceTo) parameterList += serviceTo;
  }
}

// XDSDocumentEntryType (OPTIONAL) [0..*]
var docEntryType = getXDSDocumentEntryType();
if (docEntryType) parameterList += docEntryType;

logger.info(baseLogMessage + 'Generated query parameters: ' + parameterList.toString());

