/**
	Generate LivingSubjectId query entry
	This query parameter is an identifier for a living subject. This is NOT the identifier assigned by the target registry. 
	In fact, the identifier has no context (scoping organization) other than the namespace from which the identifier was issued (OID root).

	@param {Object} patient - incoming Patient resource
	@return {Object} return XML object representing LivingSubjectId query entry
*/
function getLivingSubjectId(patient) {

	var xml = null;
	var valueList = new XMLList();

	if (patient.hasOwnProperty('identifier')) try {

		patient.identifier.forEach(function(entry) {

			if (entry.system.toString().startsWith('urn:oid:')) {
				valueList += <urn:value xmlns:urn="urn:hl7-org:v3" root={entry.system.toString().replace('urn:oid:', '')} extension={entry.value.toString()}/>;
				
			} else if ('http://hl7.org/fhir/sid/us-ssn' == entry.system.toString()) {
				valueList += <urn:value xmlns:urn="urn:hl7-org:v3" root="2.16.840.1.113883.4.1" extension={entry.value.toString()}/>;
				
			} else if ('http://hl7.org/fhir/sid/us-medicare' == entry.system.toString()) {
				valueList += <urn:value xmlns:urn="urn:hl7-org:v3" root="2.16.840.1.113883.4.572" extension={entry.value.toString()}/>;
				
			} else if ('http://hl7.org/fhir/sid/us-mbi' == entry.system.toString()) {
				valueList += <urn:value xmlns:urn="urn:hl7-org:v3" root="2.16.840.1.113883.4.927" extension={entry.value.toString()}/>;
			}			
		});
		
	} catch(ex) {
		if (globalMap.containsKey('TEST_MODE')) logger.error('Code Template: getLivingSubjectId() - ' + ex);
	}
		
	if (valueList.length() > 0) {
		xml = <urn:livingSubjectId xmlns:urn="urn:hl7-org:v3">
				<urn:semanticsText>LivingSubject.id</urn:semanticsText>
			</urn:livingSubjectId>;		
		xml.insertChildBefore(xml.*::semanticsText[0], valueList);
	}

	return xml;

}