/**
	Generates a sender class from the Transmission Wrapper (MCCI_DM000000UV).
	Includes optinal asAgent [0..1] (Agent)	

	@param {String} oid - an OID of the sending organization
	@param {String} name - an OID of the sending organization
	@return {Object} return Receiver XML object
*/
function getHL7v3Sender(oid, name) {

	// Device.id - A unique identifier for the Entity. (REQUIRED)
	// An instance identifier is a unique identifier, not a classifier.

	// Organization.name - A non-unique textual identifier or moniker for the Entity. (OPTIONAL)

	// Structural attributes are required

	try {
	
		var sender = <urn:sender typeCode="SND" xmlns:urn="urn:hl7-org:v3">
				    <urn:device classCode="DEV" determinerCode="INSTANCE">
				      <urn:id root={oid.toString()}/>
				      <urn:asAgent classCode="AGNT">
				        <urn:representedOrganization classCode="ORG" determinerCode="INSTANCE">
				          <urn:id root={oid.toString()}/>
				          <urn:name>{name.toString()}</urn:name>
				        </urn:representedOrganization>
				      </urn:asAgent>
				    </urn:device>
				  </urn:sender>;
	
		if (0 == String(name).length) delete sender.device.asAgent.representedOrganization.name;
	
		return sender;

	} catch(ex) {
		if (globalMap.containsKey('TEST_MODE')) logger.error('Code Template: getHL7v3Sender() - ' + ex);
		return null;
	}
}