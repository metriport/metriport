logger.info("sourceConnector-transformer-step-4-Get SAML attributes.js" + msg);
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
	saml.organizationId = attributes.*::Attribute.('urn:oasis:names:tc:xspa:1.0:subject:organization-id' == @Name).*::AttributeValue.toString().replace('urn:oid:', '');
	saml.homeCommunityId = attributes.*::Attribute.('urn:nhin:names:saml:homeCommunityId' == @Name).*::AttributeValue.toString();
	saml.purposeOfUse = attributes.*::Attribute.('urn:oasis:names:tc:xspa:1.0:subject:purposeofuse' == @Name).*::AttributeValue.*::PurposeOfUse.@code.toString();

} catch(ex) {
	if (globalMap.containsKey('TEST_MODE')) logger.error('XCPD Inbound Processor: SAML Processing - ' + ex);
	throw ex;
}