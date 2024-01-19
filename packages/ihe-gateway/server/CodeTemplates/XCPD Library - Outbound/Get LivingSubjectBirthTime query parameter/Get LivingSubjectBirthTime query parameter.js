/**
	Generate LivingSubjectBirthTime query entry
	This query parameter is the birth date of a living subject.

	@param {String} date - Patient's birth date separated by '-'
	@return {Object} return XML object representing LivingSubjectBirthTime query entry
*/
function getLivingSubjectBirthTime(date) {

	var xml = null;

	try {
		
		xml = <urn:livingSubjectBirthTime xmlns:urn="urn:hl7-org:v3">
				<urn:value value={date.toString().replace(/-/g, '')}/>
				<urn:semanticsText>LivingSubject.birthTime</urn:semanticsText>
			</urn:livingSubjectBirthTime>;		

	} catch(ex) {
		if (globalMap.containsKey('TEST_MODE')) logger.error('Code Template: getLivingSubjectBirthTime() - ' + ex);
	}

	return xml;

}