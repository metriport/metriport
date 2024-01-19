// CASE 1: The Responding Gateway finds exactly one patient record matching the criteria sent in the query parameters
// AA (application accept) is returned in Acknowledgement.typeCode (transmission wrapper).
// OK (data found, no errors) is returned in QueryAck.queryResponseCode (control act wrapper) 
// One RegistrationEvent (and the associated Patient role, subject of that event) is returned from the patient information source for the patient record found. 

if ('AA' == ack.toString() && 'OK' == queryResponseCode.toString()) try {

	if (xml.*::controlActProcess.*::subject.*::registrationEvent) {

		// A globally unique identifier for a community
		homeCommunityId = xml.*::controlActProcess.*::subject.*::registrationEvent.*::custodian.*::assignedEntity.*::id.@root.toString();
		channelMap.put('HOMECOMMUNITY', homeCommunityId.toString());
		channelMap.put('RESULT', 'ONE MATCH');

		var subject1 = xml.*::controlActProcess.*::subject.*::registrationEvent.*::subject1;

		var _response = getXCPD55ResponseTemplate(channelMap.get('REQUEST'), null);
		// Dec 20: xcpdPatientId to gatewayPatientId
		_response.gatewayPatientId = {"id":"", "system":""};
		_response.gatewayPatientId.id = subject1.*::patient.*::id.@extension.toString();
		_response.gatewayPatientId.system = subject1.*::patient.*::id.@root.toString();

		// A special case when the responder provided the asOtherIDs node
		if (0 == String(_response.gatewayPatientId.id).length || 0 == String(_response.gatewayPatientId.system).length) {
			_response.gatewayPatientId.id = subject1.*::patient.*::patientPerson.*::asOtherIDs.*::id.@extension.toString();
			_response.gatewayPatientId.system = subject1.*::patient.*::patientPerson.*::asOtherIDs.*::id.@root.toString();
		}

		_response.patientMatch = true;
		// Dec 20: xcpdHomeCommunityId to gatewayHomeCommunityId
		_response.gatewayHomeCommunityId = homeCommunityId;

		var patientResource = getXCPDPatientResource(subject1.toString());
		if (patientResource) _response.patientResource = patientResource;
		
		// Send the response back to the app
		var result = router.routeMessageByChannelId(globalMap.get('XCPDAPPINTERFACE'), JSON.stringify(_response));
	}
	
	// Stop further processing
	return;

} catch(ex) {
	if (globalMap.containsKey('TEST_MODE')) logger.error('XCPD ITI-55 Processor: Response (Case1) - ' + ex);
	channelMap.put('RESPONSE_ERROR', ex.toString());
}