/**
	Converts HL7v3 'telecom' element to FHIR 'ContactPoint' element

	@param {Object} telecom - telecom element
	@return {Object} return FHIR ContactPoint element
*/
function getFHIRContactPoint(telecom) {

	var contactPoint = {};

	try {
		// HL7v3 allows a combination of phone use: <tel value="tel:+15556755745" use="H WP"/>
		// FHIR ContactPoint data type allows only one 'use'
		if (telecom.@use.toString().indexOf('H') > -1) contactPoint.use = 'home';
		else if (telecom.@use.toString().indexOf('W') > -1) contactPoint.use = 'work';
		else if (telecom.@use.toString().indexOf('T') > -1) contactPoint.use = 'temp';
		else if (telecom.@use.toString().indexOf('B') > -1) contactPoint.use = 'old';

		if (telecom.@value.toString().indexOf('tel') > -1) contactPoint.system = 'phone';
		else if (telecom.@value.toString().indexOf('fax') > -1) contactPoint.system = 'fax';
		else if (telecom.@value.toString().indexOf('mail') > -1) contactPoint.system = 'email';

		contactPoint.value = telecom.@value.toString().split(':').pop();
		
	} catch(ex) {
		if (globalMap.containsKey('TEST_MODE')) logger.error('Code Template: getContactPoint() - ' + ex);
		return null;
	}
	
	return contactPoint;
}