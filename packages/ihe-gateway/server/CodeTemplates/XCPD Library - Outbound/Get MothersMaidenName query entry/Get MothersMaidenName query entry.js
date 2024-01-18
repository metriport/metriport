/**
	This query parameter is the maiden name of a focal person's mother. 
	It is included as a parameter because it is a common attribute for confirming the identity of persons in some registries.
	In this case it may consist of only the given name part, the family name part, or both.

	@param {Object} name - a mother's maiden name
	@return {Object} return XML object representing LivingSubjectName query entry
*/
function getMothersMaidenName(name) {

	var xml = null;

	// The FHIR http://hl7.org/fhir/StructureDefinition/patient-mothersMaidenName extension allows only a single string value
	try {
		
		xml = <urn:mothersMaidenName xmlns:urn="urn:hl7-org:v3">
				     <urn:value>{name.toString()}</urn:value>
				     <urn:semanticsText>Person.MothersMaidenName</urn:semanticsText>
				   </urn:mothersMaidenName>;
			   
	} catch(ex) {
		if (globalMap.containsKey('TEST_MODE')) logger.error('Code Template: getMothersMaidenName() - ' + ex);
	}
	
	return xml;
}