/**
	Generates XDSDocumentEntryCreationTimeFrom slot entry

	@param {String} timestamp - timestamp to convert
	@return {Object} return XDSDocumentEntryCreationTimeFrom slot entry
*/
function getXDSDocumentEntryCreationTimeFrom(timestamp) {

	try {
		
		var xml = <urn2:Slot name="$XDSDocumentEntryCreationTimeFrom" xmlns:urn2="urn:oasis:names:tc:ebxml-regrep:xsd:rim:3.0">
					<urn2:ValueList>
						<urn2:Value>{timestamp.toString().replace(/\D/g, '').slice(0, 14)}</urn2:Value>
					</urn2:ValueList>
				</urn2:Slot>;
	
		return xml;
		
	} catch(ex) {
		if (globalMap.containsKey('TEST_MODE')) logger.error('Code Template: getXDSDocumentEntryCreationTimeFrom() - ' + ex);
		return null;
	}
}



/**
	Generates XDSDocumentEntryCreationTimeTo slot entry

	@param {String} timestamp - timestamp to convert
	@return {Object} return XDSDocumentEntryCreationTimeTo slot entry
*/
function getXDSDocumentEntryCreationTimeTo(timestamp) {

	try {
		
		var xml = <urn2:Slot name="$XDSDocumentEntryCreationTimeTo" xmlns:urn2="urn:oasis:names:tc:ebxml-regrep:xsd:rim:3.0">
					<urn2:ValueList>
						<urn2:Value>{timestamp.toString().replace(/\D/g, '').slice(0, 14)}</urn2:Value>
					</urn2:ValueList>
				</urn2:Slot>;
	
		return xml;

	} catch(ex) {
		if (globalMap.containsKey('TEST_MODE')) logger.error('Code Template: getXDSDocumentEntryCreationTimeTo() - ' + ex);
		return null;
	}
}