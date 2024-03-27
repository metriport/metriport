/**
	Generates an XCPD HL7v3 PRPA_IN201306UV02 response from the AWS Lambda response

	@param {Object} lambda - AWS Lambda response in JSON format
	@param {Object} payload - original PRPA_IN201305UV02 request in XML format
	@return {Object} return PRPA_IN201306UV02 response in XML format
*/
function getXCPDQueryResponse(lambda, payload) {
	const senderOID = Config.getHomeCommunityId();
	const uuid = UUIDGenerator.getUUID();

	// May be valued by the initiating application to identify the query
	var queryExt = null, queryRoot = null;
	try {
		queryExt = payload.controlActProcess.queryByParameter.queryId.@extension.toString();
		queryRoot = payload.controlActProcess.queryByParameter.queryId.@root.toString();
	} catch(ex) {
		queryExt = payload.id.@extension.toString();
		queryRoot = payload.id.@root.toString();
	}

	var xml = <PRPA_IN201306UV02 ITSVersion="XML_1.0">
			  <id root={senderOID} extension={uuid.toString()}/>
			  <creationTime value={DateUtil.getCurrentDate('yyyyMMddhhmmss')}/>
			  <interactionId root="2.16.840.1.113883.1.6" extension="PRPA_IN201306UV02"/>
			  <processingCode code="P"/>
			  <processingModeCode code="T"/>
			  <acceptAckCode code="NE"/>
			  <sender typeCode="SND">
			    <device classCode="DEV" determinerCode="INSTANCE">
			      <id root={senderOID}/>
			    </device>
			  </sender>
			  <acknowledgement>
			    <typeCode code="AE"/>
			    <targetMessage>
			      <id root={payload.id.@root.toString()} extension={payload.id.@extension.toString()}/>
			    </targetMessage>
			  </acknowledgement>
			  <controlActProcess classCode="CACT" moodCode="EVN">
			    <code code="PRPA_TE201306UV02" codeSystem="2.16.840.1.113883.1.6"/>
			    <authorOrPerformer/>
			    <subject/>
			    <reasonOf/>
			    <queryAck>
			      <queryId root={queryRoot.toString()} extension={queryExt.toString()}/>
			      <queryResponseCode code="AE"/>
			    </queryAck>
			    <queryByParameter>
			      <queryId root={queryRoot.toString()} extension={queryExt.toString()}/>
			      <statusCode code="new"/>
			      <parameterList/>
			    </queryByParameter>
			  </controlActProcess>
			</PRPA_IN201306UV02>;

	// Reverse the sender tag
	var sender = payload.sender;
	sender.setLocalName('receiver');
	xml.insertChildBefore(xml.sender[0], sender);

	// Initial parameter list
	xml.controlActProcess.queryByParameter.parameterList = payload.controlActProcess.queryByParameter.parameterList;

	// Specify the reason for the fault
	if (lambda.hasOwnProperty('operationOutcome')) try {

		var count = 0;
		var reasonOf = <reasonOf typeCode="RSON">
				      <detectedIssueEvent classCode="ALRT" moodCode="EVN">
				        <code code="_ActAdministrativeDetectedIssueManagementCode" codeSystem="2.16.840.1.113883.5.4" codeSystemName="Act Code"/>
				      </detectedIssueEvent>
				    </reasonOf>;

		lambda.operationOutcome.issue.forEach(function(issue) {

			if (['fatal','error','warning'].indexOf(issue.severity.toString()) > -1) {
				issue.details.coding.forEach(function(coding) {
					var mitigatedBy = <mitigatedBy typeCode="MITGT">
							          <detectedIssueManagement classCode="ACT" moodCode="EVN">
							            <code code={coding.code.toString()} codeSystem={coding.system.toString()}/>
							          </detectedIssueManagement>
							        </mitigatedBy>;
					if (coding.hasOwnProperty('display') && isNotEmpty(coding.display)) {
						var text = <text>{coding.display.toString()}</text>;
						mitigatedBy.detectedIssueManagement.appendChild(text);
					}
					reasonOf.detectedIssueEvent.appendChild(mitigatedBy);
					count++;
				});

			} else if ('information' == issue.severity.toString()) {
				issue.details.coding.forEach(function(coding) {
					var triggerFor = <triggerFor typeCode="TRIG">
							          <actOrderRequired classCode="ACT" moodCode="RQO">
							            <code code={coding.code.toString()} codeSystem={coding.system.toString()}/>
							          </actOrderRequired>
							        </triggerFor>;
					reasonOf.detectedIssueEvent.appendChild(triggerFor);
					count++;
				});

			} else {
				// Unknown severity codes are ignored
				return;
			}
		});

		if (count > 0) {
			xml.controlActProcess.reasonOf = reasonOf;
		} else {
			delete xml.controlActProcess.reasonOf;
		}

	} catch(ex) {
		if (globalMap.containsKey('TEST_MODE')) logger.error('Code Template: XCPD Inbound Fault Response - ' + ex);
	}

	return xml;
}