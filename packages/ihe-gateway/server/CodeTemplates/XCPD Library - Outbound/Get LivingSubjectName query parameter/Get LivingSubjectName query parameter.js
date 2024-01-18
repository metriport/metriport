/**
	Generate LivingSubjectName query entry
	This query parameter is the name of a living subject. This query parameter is the name of a person. 
	If multiple instances of LivingSubjectName are provided, the receiver must consider them as possible alternatives, logically connected with an "or".

	@param {Object} name - a single Patient.name element
	@return {Object} return XML object representing LivingSubjectName query entry
*/
function getLivingSubjectName(name) {

	var xml = null;

	// Only one instance of the value element is allowed. Only some of the name parts may be populated. 
	// If, for example, only the family and given name parts of a person's name are sent, then the query would match all persons with that family name and given name regardless of their initials. 
	// The use attribute of the value element shall not be set to "SRCH".

	try {

		xml = <urn:livingSubjectName xmlns:urn="urn:hl7-org:v3">
				<urn:value/>	
				<urn:semanticsText>LivingSubject.name</urn:semanticsText>
			</urn:livingSubjectName>;

		if (name.hasOwnProperty('family')) {
			var family = <urn:family xmlns:urn="urn:hl7-org:v3">{name.family.toString()}</urn:family>;
			xml.*::value.appendChild(family);
		}

		// TODO: Process multiple given names (requires XMLList)		
		if (name.hasOwnProperty('given')) {
			var given = <urn:given xmlns:urn="urn:hl7-org:v3">{name.given[0].toString()}</urn:given>;
			xml.*::value.appendChild(given);
/*			
			name.given.forEach(entry => {
				var given = <given>{name.given.toString()}</given>;
				xml.value.appendChild(given);
			});
*/			
		}

	} catch(ex) {
		if (globalMap.containsKey('TEST_MODE')) logger.error('Code Template: getLivingSubjectName() - ' + ex);
	}

	return xml;
}