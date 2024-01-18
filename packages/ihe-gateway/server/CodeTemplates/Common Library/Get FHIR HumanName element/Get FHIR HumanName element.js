/**
	Converts HL7v3 'name' element to FHIR 'HumanName' element

	@param {Object} name - HL7v3 name element
	@return {Object} return FHIR HumanName element
*/
function getFHIRHumanName(name) {

	// TODO: Prefix and Suffix

	var humanName = {"family":"", "given": []};

	try {
		
		if (isNotEmpty(name.family)) {
			humanName.family = name.family.toString();
		} else {
			delete humanName.family;
		}

		for each (var firstName in name.given) {
			humanName.given.push(firstName.toString());
		}
		if (0 == humanName.given.length) delete humanName.given;
		
	} catch(ex) {
		if (globalMap.containsKey('TEST_MODE')) logger.error('Code Template: getHumanName() - ' + ex);
		return null
	}

	return humanName;	
}