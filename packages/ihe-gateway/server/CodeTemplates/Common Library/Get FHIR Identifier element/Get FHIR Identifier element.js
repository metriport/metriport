/**
	Converts HL7v3 'id' element to FHIR 'identifier' element

	@param {Object} id - HL7v3 id element
	@return {Object} return FHIR Identifier element
*/
function getFHIRIdentifier(id) {

	var identifier = {};

	try {		
		if (isNotEmpty(id.@extension)) identifier.value = id.@extension.toString();
		if (isNotEmpty(id.@root)) identifier.system = 'urn:oid:' + id.@root.toString();		
	} catch(ex) {
		if (globalMap.containsKey('TEST_MODE')) logger.error('Code Template: getIdentifier() - ' + ex);
		return null
	}

	return identifier;
}