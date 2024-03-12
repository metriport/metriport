// CASE 1: The Responding Gateway finds exactly one patient record matching the criteria sent in the query parameters
// AA (application accept) is returned in Acknowledgement.typeCode (transmission wrapper).
// OK (data found, no errors) is returned in QueryAck.queryResponseCode (control act wrapper)
// One RegistrationEvent (and the associated Patient role, subject of that event) is returned from the patient information source for the patient record found.

var requestId = channelMap.get('MSG_ID');
var cxId = channelMap.get('CUSTOMER_ID');

var baseLogMessage = "XCPD ITI55 Processor: Response (Case1) - requestId: " + requestId.toString() + ", " + "cxId: " + cxId.toString() + " - ";

if ('AA' == ack.toString() && 'OK' == queryResponseCode.toString()) try {

	if (xml.*::controlActProcess.*::subject.*::registrationEvent) {

		// A globally unique identifier for a community
		homeCommunityId = xml.*::controlActProcess.*::subject.*::registrationEvent.*::custodian.*::assignedEntity.*::id.@root.toString();
		channelMap.put('HOMECOMMUNITY', homeCommunityId.toString());
		channelMap.put('RESULT', 'ONE MATCH');

		var subject1 = xml.*::controlActProcess.*::subject.*::registrationEvent.*::subject1;

		var _response = getXCPD55ResponseTemplate(channelMap.get('REQUEST'), null);
		// Dec 20: xcpdPatientId to gatewayPatientId
		// Feb 25: gatewayPatientId to externalGatewayPatient
		_response.externalGatewayPatient = {"id":"", "system":""};
		_response.externalGatewayPatient.id = subject1.*::patient.*::id.@extension.toString();
		_response.externalGatewayPatient.system = subject1.*::patient.*::id.@root.toString();

		// A special case when the responder provided the asOtherIDs node
		if (0 == String(_response.externalGatewayPatient.id).length || 0 == String(_response.externalGatewayPatient.system).length) {
			_response.externalGatewayPatient.id = subject1.*::patient.*::patientPerson.*::asOtherIDs.*::id.@extension.toString();
			_response.externalGatewayPatient.system = subject1.*::patient.*::patientPerson.*::asOtherIDs.*::id.@root.toString();
		}

		_response.patientMatch = true;
		// Dec 20: xcpdHomeCommunityId to gatewayHomeCommunityId
		_response.gatewayHomeCommunityId = homeCommunityId;

		var patientResource = getXCPDPatientResource(subject1.toString());
		if (patientResource) _response.patientResource = patientResource;

    logger.info(baseLogMessage + 'Response: ' + JSON.stringify(_response));

		// Send the response back to the app
		var result = router.routeMessageByChannelId(globalMap.get('XCPDAPPINTERFACE'), JSON.stringify(_response));
	}

	// Stop further processing
	return;

} catch(ex) {
  logger.error(baseLogMessage + 'Error: ' + ex);
	channelMap.put('RESPONSE_ERROR', ex.toString());
	throw ex;
}