/**
	Generates a receiver class from the Transmission Wrapper (MCCI_DM000000UV).

	@param {String} oid - an OID of the receiving organization
	@param {String} url - message receiving endpoint
	@return {Object} return Receiver XML object
*/
function getHL7v3Receiver(oid, url) {

	// Structural attributes are required
	try {
		
		var receiver = <urn:receiver typeCode="RCV" xmlns:urn="urn:hl7-org:v3">
					    <urn:device classCode="DEV" determinerCode="INSTANCE">
					      <urn:id root={oid.toString()}/>
					      <urn:telecom value={url.toString()}/>
			                    <urn:asAgent classCode="AGNT">
			                        <urn:representedOrganization classCode="ORG" determinerCode="INSTANCE">
			                            <urn:id root={oid.toString()}/>
			                        </urn:representedOrganization>
			                    </urn:asAgent>
					    </urn:device>
					  </urn:receiver>;
	
		return receiver;
		
	} catch(ex) {
		if (globalMap.containsKey('TEST_MODE')) logger.error('Code Template: getHL7v3Receiver() - ' + ex);
		return null;
	}
}