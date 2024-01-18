channelMap.put('MSG_ID', msg.*::Header.*::MessageID.toString().replace('urn:uuid:', ''));

try {
	
	var attributes = msg.*::Header.*::Security.*::Assertion.*::AttributeStatement;
	channelMap.put('ORG', attributes.*::Attribute.('urn:oasis:names:tc:xspa:1.0:subject:organization' == @Name).*::AttributeValue.toString());
	channelMap.put('OID', attributes.*::Attribute.('urn:oasis:names:tc:xspa:1.0:subject:organization-id' == @Name).*::AttributeValue.toString().replace('urn:oid:', ''));
	channelMap.put('PURPOSE', attributes.*::Attribute.('urn:oasis:names:tc:xspa:1.0:subject:purposeofuse' == @Name).*::AttributeValue.*::PurposeOfUse.@code.toString());

} catch(ex) {
	if (globalMap.containsKey('TEST_MODE')) logger.error('XCPD Inbound Interface: SAML Processing - ' + ex);
}