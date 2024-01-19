/**
	Generates XDSDocumentEntryType slot with stable and on-demand entries
	The objectType attribute on an ExtrinsicObject (DocumentEntry) is used to distinguish Stable DocumentEntries from On-Demand DocumentEntries

	@return {Object} return description
*/
function getXDSDocumentEntryType() {

	// If no value is specified for DocumentEntryType, the value requesting only Stable Document Entries shall be assumed. 
	// To get all Document Entry types, the query shall contain both of the valid values in the request.

	// urn:uuid:7edca82f-054d-47f2-a032-9b2a5b5186c1 – Stable
	// urn:uuid:34268e47-fdf5-41a6-ba33-82133c465248 – On-Demand

	var xml = <urn2:Slot name="$XDSDocumentEntryType" xmlns:urn2="urn:oasis:names:tc:ebxml-regrep:xsd:rim:3.0">
				<urn2:ValueList>
					<urn2:Value>('urn:uuid:7edca82f-054d-47f2-a032-9b2a5b5186c1','urn:uuid:34268e47-fdf5-41a6-ba33-82133c465248')</urn2:Value>
				</urn2:ValueList>
			</urn2:Slot>;

	return xml;			
}