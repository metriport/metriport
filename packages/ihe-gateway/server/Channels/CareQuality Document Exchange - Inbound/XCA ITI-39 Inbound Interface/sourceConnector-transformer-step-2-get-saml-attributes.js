try {
	// Get request response type
	var contentType = msg.*::Body.@ContentType.toString();
	if (String(contentType).indexOf('xop+xml') > 0) channelMap.put('MTOM', contentType.toString());	
} catch(ex) {}

channelMap.put('MSG_ID', msg.*::Header.*::MessageID.toString().replace('urn:uuid:', ''));

var saml = {
			"subjectId": "",
	      	"subjectRole": {"code": "", "display": ""},
	      	"organization": "",
	      	"organizationId": "",
	      	"homeCommunityId": "",
	      	"purposeOfUse": ""
		};

try {
	
	var attributes = msg.*::Header.*::Security.*::Assertion.*::AttributeStatement;
	
	saml.subjectId = attributes.*::Attribute.('urn:oasis:names:tc:xspa:1.0:subject:subject-id' == @Name).*::AttributeValue.toString();
	saml.subjectRole.code = attributes.*::Attribute.('urn:oasis:names:tc:xacml:2.0:subject:role' == @Name).*::AttributeValue.*::Role.@code.toString();
	saml.subjectRole.display = attributes.*::Attribute.('urn:oasis:names:tc:xacml:2.0:subject:role' == @Name).*::AttributeValue.*::Role.@displayName.toString();
	saml.organization = attributes.*::Attribute.('urn:oasis:names:tc:xspa:1.0:subject:organization' == @Name).*::AttributeValue.toString();
	saml.organizationId = attributes.*::Attribute.('urn:oasis:names:tc:xspa:1.0:subject:organization-id' == @Name).*::AttributeValue.toString().split(':').pop();
	saml.homeCommunityId = attributes.*::Attribute.('urn:nhin:names:saml:homeCommunityId' == @Name).*::AttributeValue.toString().split(':').pop();
	saml.purposeOfUse = attributes.*::Attribute.('urn:oasis:names:tc:xspa:1.0:subject:purposeofuse' == @Name).*::AttributeValue.*::PurposeOfUse.@code.toString();

} catch(ex) {
	if (globalMap.containsKey('TEST_MODE')) logger.error('XCA ITI-39 Inbound Interface: SAML Processing - ' + ex);
	throw ex;
}