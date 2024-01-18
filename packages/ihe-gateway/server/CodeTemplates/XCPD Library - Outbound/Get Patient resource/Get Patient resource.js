/**
	Generates the FHIR Patient resource instance from the ITI-55 response

	@param {String} subject - the 'subject1' node
	@return {Object} return the FHIR Patient resource instance
*/
function getXCPDPatientResource(subject) {

	// TODO: Race, Ethnicity, Language communication, etc.

	var patient = null;

	try {

		// Remove namespaces
		subject = String(subject).replace(/\w+:/g, '');
		subject = subject.replace('xsi:', '');
		subject = subject.replace('xmlns="hl7-v3"', '');
		
		subject = new XML(subject.toString());

		patient = {
			"resourceType": "Patient",
			"identifier": [],
			"active": false,
			"name": [],
			"telecom": [],
			"gender": "unknown",
			"birthDate": "",
			"address": []
		};
		
		// Identifiers for this patient
		var identifier = getFHIRIdentifier(subject.patient.id);
		if (identifier) patient.identifier.push(identifier);
		for each (var entry in subject.patient.patientPerson.asOtherIDs) {
			if (entry.id.@extension.toString() !== subject.patient.id.@extension.toString()) {
				identifier = getFHIRIdentifier(entry.id);	
				if (identifier) {
					identifier.system = ('2.16.840.1.113883.4.1' == entry.id.@root.toString()) ? 'http://hl7.org/fhir/sid/us-ssn' : identifier.system.toString();
					patient.identifier.push(identifier);
				}
			}
		}
		if (0 == patient.identifier.length) delete patient.identifier;
		
		
		// Whether this patient's record is in active use
		try {
			if ('active' == subject.patient.statusCode.@code.toString()) patient.active = true
		} catch(ex) {
			delete patient.active;
		}
		
		
		// Names associated with the patient
		for each (var entry in subject.patient.patientPerson.name) {
			var name = getFHIRHumanName(entry);
			if (name) patient.name.push(name);
		}
		if (0 == patient.name.length) delete patient.name;
		
		
		// Contact detail for the individual
		for each (var entry in subject.patient.patientPerson.telecom) {
			var telecom = getFHIRContactPoint(entry);
			if (telecom) patient.telecom.push(telecom);
		}
		if (0 == patient.telecom.length) delete patient.telecom;
		
		
		// AdministrativeGender
		try {
			patient.gender = getFHIRAdministrativeGender(subject.patient.patientPerson.administrativeGenderCode);
		} catch(ex) {
			delete patient.gender;
		}
		
		
		// The date of birth for the individual
		try {
			patient.birthDate = DateUtil.convertDate('yyyyMMdd', 'yyyy-MM-dd', subject.patient.patientPerson.birthTime.@value.toString().substring(0, 8))
		} catch(ex) {
			delete patient.birthDate;
		}
		
		
		// Address for the individual
		for each (var entry in subject.patient.patientPerson.addr) {
			var address = getFHIRAddress(entry);
			if (address) patient.address.push(address);
		}
		if (0 == patient.address.length) delete patient.address;
		
	} catch(ex) {
		if (globalMap.containsKey('TEST_MODE')) logger.error('Code Template: getXCPDPatientResource() - ' + ex);
		return null;
	}

	return patient;
	
}