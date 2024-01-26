/**
	Sets SAML variables
	Default variables are taken from the Mirth Connect configuration

	@param {Object} msg - original msg object
*/
function setSAMLAttributes(msg) {
  // The name of the organization that the user belongs to as required by HIPAA Privacy Disclosure Accounting
  channelMap.put("Organization", configurationMap.get("SAML.Organization"));
  if (
    msg.samlAttributes.hasOwnProperty("organization") &&
    msg.samlAttributes.organization.toString().length > 0
  )
    try {
      channelMap.put("Organization", msg.samlAttributes.organization.toString());
    } catch (ex) {}

  var homeCommunityId = Config.getSamlHomeCommunityId();

  if (homeCommunityId) {
    // The value SHALL be the Home Community ID (an Object Identifier) assigned to the NHIO that is initiating the request, using the urn format
    channelMap.put("HomeCommunityId", homeCommunityId);
  } else {
    logger.error("SAML_HOME_COMMUNITY_ID environment variable is not set");
  }
  if (
    msg.samlAttributes.hasOwnProperty("homeCommunityId") &&
    msg.samlAttributes.homeCommunityId.toString().length > 0
  )
    try {
      var homeCommunityId = msg.samlAttributes.homeCommunityId.toString().startsWith("urn:oid:")
        ? msg.samlAttributes.homeCommunityId.toString().replace("urn:oid:", "")
        : msg.samlAttributes.homeCommunityId.toString();
      channelMap.put("HomeCommunityId", homeCommunityId.toString());
    } catch (ex) {}

  // This element SHALL contain the coded representation of the reason for the request
  channelMap.put("PurposeOfUseCode", configurationMap.get("SAML.PurposeOfUse"));
  if (
    msg.samlAttributes.hasOwnProperty("purposeOfUse") &&
    msg.samlAttributes.purposeOfUse.toString().length > 0
  )
    try {
      channelMap.put("PurposeOfUseCode", msg.samlAttributes.purposeOfUse.toString());
    } catch (ex) {}

  channelMap.put("PurposeOfUseDisplay", getTitleCase(channelMap.get("PurposeOfUseCode")));

  // This element SHALL contain the SNOMED CT value representing the role that the user (Subject ID) is playing when making the request
  channelMap.put("SubjectRoleCode", configurationMap.get("SAML.SubjectRole.Code"));
  channelMap.put("SubjectRoleDisplay", configurationMap.get("SAML.SubjectRole.Display"));
  if (
    msg.samlAttributes.hasOwnProperty("subjectRole") &&
    msg.samlAttributes.subjectRole.code.toString().length > 0 &&
    msg.samlAttributes.subjectRole.display.toString().length > 0
  )
    try {
      channelMap.put("SubjectRoleCode", msg.samlAttributes.subjectRole.code.toString());
      channelMap.put("SubjectRoleDisplay", msg.samlAttributes.subjectRole.display.toString());
    } catch (ex) {}
}
