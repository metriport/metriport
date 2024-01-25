// Check for the FHIR Patient resource in the incoming message
if (!msg.hasOwnProperty('patientResource')) throw 'ERROR - The required FHIR Patient resource is missing. The processing has been stopped.';

// The query parameters below are constrained in the PRPA_MT201306IHEPCD [Patient Registry Query By Demographics] message
// The order follows that of the PRPA_MT201306UV02 [Patient Registry Query By Demographics] message

/*
To ensure the XML is valid, parameters must be in the following order:
	livingSubjectAdministrativeGender
	livingSubjectBirthPlaceAddress
	livingSubjectBirthPlaceName
	livingSubjectBirthTime
	livingSubjectDeceasedTime	-- Not used in XCPD ITI-55 query 
	livingSubjectId
	livingSubjectName
	mothersMaidenName
	otherIDsScopingOrganization	-- Not used in XCPD ITI-55 query
	patientAddress
	patientStatusCode			-- Not used in XCPD ITI-55 query
	patientTelecom
	principalCareProviderId
	principalCareProvisionId		-- Not used in XCPD ITI-55 query
*/

var patient = msg.patientResource;
var parameterList = new XMLList();

// Values from extensions
var	birthPlaceAddress = null, 
	birthDateTime = null, 
	mothersMaidenName = null;

if (patient.hasOwnProperty('extension')) {	
	try {
		var i = patient.extension.findIndex(function(entry) {return 'http://hl7.org/fhir/StructureDefinition/patient-birthPlace' == entry.url.toString();});
		birthPlaceAddress = (i > -1) ? patient.extension[i].valueAddress : null;
	} catch(ex) {
		if (globalMap.containsKey('TEST_MODE')) logger.error('XCPD ITI-55 Processor: Source - ' + ex);
	}
	try {
		var i = patient.extension.findIndex(function(entry) {return 'http://hl7.org/fhir/StructureDefinition/patient-birthTime' == entry.url.toString();});
		birthDateTime = (i > -1) ? patient.extension[i].valueDateTime.toString() : null;
	} catch(ex) {
		if (globalMap.containsKey('TEST_MODE')) logger.error('XCPD ITI-55 Processor: Source - ' + ex);
	}
	try {
		var i = patient.extension.findIndex(function(entry) {return 'http://hl7.org/fhir/StructureDefinition/patient-mothersMaidenName' == entry.url.toString();});
		mothersMaidenName = (i > -1) ? patient.extension[i].valueString.toString() : null;
	} catch(ex) {
		if (globalMap.containsKey('TEST_MODE')) logger.error('XCPD ITI-55 Processor: Source - ' + ex);
	}
}

// This query parameter is a code representing the administrative gender of a living subject in a patient registry
// livingSubjectAdministrativeGender [0..1], value [1..1]
if (patient.hasOwnProperty('gender')) {
	var gender = getLivingSubjectAdministrativeGender(patient);
	if (gender) parameterList += gender;
}


// This query parameter is a patient's birthplace represented as an address
// livingSubjectBirthPlaceAddress [0..1], value [1..*]
if (birthPlaceAddress) {
	var address = getLivingSubjectBirthPlaceAddress(birthPlaceAddress);
	if (address) parameterList += address;
}


// This query parameter is a patient's birthplace represented as a place name
// livingSubjectBirthPlaceName [0..1], value [1..*]
var birthPlace = getLivingSubjectBirthPlaceName(patient);
if (birthPlace) parameterList += birthPlace;


// This query parameter is the birth date of a living subject
// livingSubjectBirthTime [0..1], value [1..1]
var birthTime = null;
if (birthDateTime) {
	birthTime = getLivingSubjectBirthTime(birthDateTime);
} else if (patient.hasOwnProperty('birthDate')) {
	birthTime = getLivingSubjectBirthTime(patient.birthDate.toString());
}
if (birthTime) parameterList += birthTime;


// This query parameter is an identifier for a living subject. 
// This is NOT the identifier assigned by the target registry. 
// In fact, the identifier has no context (scoping organization) other than the namespace from which the identifier was issued (OID root).
// livingSubjectId [0..*], value [1..*]
var patientID = getLivingSubjectId(patient);
if (patientID) parameterList += patientID;


// This query parameter is the name of a living subject.
// If multiple instances of LivingSubjectName are provided, the receiver must consider them as possible alternatives, logically connected with an "or".
// livingSubjectName [0..*], value [1..1]
if (patient.hasOwnProperty('name')) {
	patient.name.forEach(function(entry) {
		var name = getLivingSubjectName(entry);
		if (name) parameterList += name;
	});
}


// This query parameter is the maiden name of a focal person's mother. 
// It is included as a parameter because it is a common attribute for confirming the identity of persons in some registries. 
// mothersMaidenName [0..*], value [1..1]
if (mothersMaidenName) {
	var mMaidenName = getMothersMaidenName(mothersMaidenName);
	if (mMaidenName) parameterList += mMaidenName;
}


// This query parameter is a postal address for corresponding with a living subject in the context of the target patient registry.
// There shall be only a single PatientAddress element.
// Multiple instances of the value element within a Patient Address may be specified and are combined with OR logic.
// patientAddress [0..1], value [1..*]
if (patient.hasOwnProperty('address')) {
	var address = getPatientAddress(patient.address);
	if (address) parameterList += address;
}


// This query parameter is a telecommunications address for communicating with a living subject in the context of the target patient registry. 
// It could be a telephone number, fax number or even an email address. There shall be only a single PatientTelecom element.
// Multiple instances of the value element within a PatientTelecom may be specified and are combined with OR logic.
// patientTelecom [0..*] getPatientTelecom()
if (patient.hasOwnProperty('telecom')) {
	var telecom = getPatientTelecom(patient.telecom);
	if (telecom) parameterList += telecom;
}


// This query parameter is the care provider identifier of a person who has been assigned as the principal care provider of this patient. 
// The requestor may specify multiple PrincipalCareProviderId elements which responder shall consider as possible alternatives, logically connected with an "or".
// principalCareProviderId [0..*], value [1..1] 
if (msg.hasOwnProperty('principalCareProviderIds')) {
	msg.principalCareProviderIds.forEach(function(id) {
		var provider = getPrincipalCareProviderId(id);
		if (provider) parameterList += provider;
	});
}

// ========== Following parameters are present in PRPA_MT201306UV02 but not used in PRPA_MT201306IHEPCD ==========
// This query parameter is the death date of a living subject. It is used to find patients who have died on a known date or within a date interval
// livingSubjectDeceasedTime [0..*]

// This query parameter is another organization that has registered the focal patient in its registry. 
// It is used to find living subjects who have been registered by a particular organization.
// otherIDsScopingOrganization [0..*]

// This query parameter is the status of a record in the target patient registry. 
// It is used to find records in a particular state such as "active" or "completed".
// patientStatusCode [0..*]

// This query parameter is the identifier the explicit acceptance for some aspect of a patient's care by a health care provider. 
// This identifies a Care Provision act.
// principalCareProvisionId [0..*]