/**
	Generate livingSubjectAdministrativeGender query entry
	This query parameter is a code representing the administrative gender of a living subject in a patient registry

	@param {Object} patient - incoming Patient resource
	@return {Object} return XML object representing LivingSubjectAdministrativeGender query entry
*/
function getLivingSubjectAdministrativeGender(patient) {

	// 'Undifferentiated' by default
	var gender = 'UN';

	try {
		
		if (String(patient.gender).toUpperCase().startsWith('M')) gender = 'M'
		else if (String(patient.gender).toUpperCase().startsWith('F')) gender = 'F'

	} catch(ex) {
		if (globalMap.containsKey('TEST_MODE')) logger.error('Code Template: getLivingSubjectAdministrativeGender() - ' + ex);
	}
	
	var xml = <urn:livingSubjectAdministrativeGender xmlns:urn="urn:hl7-org:v3">
				<urn:value code={gender.toString()} codeSystem="2.16.840.1.113883.5.1"/>
				<urn:semanticsText>LivingSubject.administrativeGender</urn:semanticsText>
			</urn:livingSubjectAdministrativeGender>;

	return xml;
}
