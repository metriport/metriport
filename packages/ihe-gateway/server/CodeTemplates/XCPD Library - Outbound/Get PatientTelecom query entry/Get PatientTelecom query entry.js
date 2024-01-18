/**
	Generates PatientTelecom query entry
	This query parameter is a telecommunications address for communicating with a living subject in the context of the target patient registry. 
	It could be a telephone number, fax number or even an email address. There shall be only a single PatientTelecom element.
	A telecommunications address. The scheme attribute specifies whether this is a telephone number, fax number, email address, etc. 
	Multiple instances of the value element within a PatientTelecom may be specified and are combined with OR logic.

	@param {Object} telecom - Patient.telecom element
	@return {Object} return XML object representing PatientTelecom query entry
*/
function getPatientTelecom(telecom) {

	// TODO: The FHIR ContactPoint.use component is not being processed

	var xml = null;
	var valueList = new XMLList();

	try {
		telecom.forEach(function(tel) {

			var prefix = '';

			if (tel.hasOwnProperty('system')) {
				// Map FHIR ContactPoint.system to HL7v3 syntax
				var prefix = ['tel:','fax:','email:','','','sms:',''][['phone','fax','email','pager','url','sms','other'].indexOf(tel.system.toString())];
				prefix = (prefix) ? prefix : '';
			}
			
			var value = <urn:value xmlns:urn="urn:hl7-org:v3" value={prefix.toString() + tel.value.toString()}/>;			
			valueList += value;
				
		});

	} catch(ex) {
		if (globalMap.containsKey('TEST_MODE')) logger.error('Code Template: getPatientTelecom() - ' + ex);
	}

	if (valueList.length() > 0) {
		xml = <urn:patientTelecom xmlns:urn="urn:hl7-org:v3">
				<urn:semanticsText>Patient.telecom</urn:semanticsText>
			</urn:patientTelecom>;
		xml.insertChildBefore(xml.*::semanticsText[0], valueList);
	}

	return xml;
}