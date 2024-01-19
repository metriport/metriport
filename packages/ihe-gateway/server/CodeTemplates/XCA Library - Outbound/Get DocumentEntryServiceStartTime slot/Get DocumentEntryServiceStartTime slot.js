/**
	Generates XDSDocumentEntryServiceStartTimeFrom slot entry

	@param {String} timestamp - timestamp to convert
	@return {Object} return XDSDocumentEntryServiceStartTimeFrom slot entry
*/
function getXDSDocumentEntryServiceStartTimeFrom(timestamp) {

	try {

		var xml = <urn2:Slot name="$XDSDocumentEntryServiceStartTimeFrom" xmlns:urn2="urn:oasis:names:tc:ebxml-regrep:xsd:rim:3.0">
					<urn2:ValueList>
						<urn2:Value>{timestamp.toString().replace(/\D/g, '').slice(0, 14)}</urn2:Value>
					</urn2:ValueList>
				</urn2:Slot>;
	
		return xml;

	} catch(ex) {
		if (globalMap.containsKey('TEST_MODE')) logger.error('Code Template: getXDSDocumentEntryServiceStartTimeFrom() - ' + ex);
		return null;
	}
}



/**
	Generates XDSDocumentEntryServiceStartTimeTo slot entry

	@param {String} timestamp - timestamp to convert
	@return {Object} return XDSDocumentEntryServiceStartTimeTo slot entry
*/
function getXDSDocumentEntryServiceStartTimeTo(timestamp) {

	try {
		
		var xml = <urn2:Slot name="$XDSDocumentEntryServiceStartTimeTo" xmlns:urn2="urn:oasis:names:tc:ebxml-regrep:xsd:rim:3.0">
					<urn2:ValueList>
						<urn2:Value>{timestamp.toString().replace(/\D/g, '').slice(0, 14)}</urn2:Value>
					</urn2:ValueList>
				</urn2:Slot>;
	
		return xml;

	} catch(ex) {
		if (globalMap.containsKey('TEST_MODE')) logger.error('Code Template: getXDSDocumentEntryServiceStartTimeTo() - ' + ex);
		return null;
	}
}