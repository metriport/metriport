var soap = <soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope" xmlns:urn="urn:oasis:names:tc:ebxml-regrep:xsd:query:3.0" xmlns:urn1="urn:oasis:names:tc:ebxml-regrep:xsd:rs:3.0" xmlns:urn2="urn:oasis:names:tc:ebxml-regrep:xsd:rim:3.0">
   <soap:Header>
	<wsa:To xmlns:wsa="http://www.w3.org/2005/08/addressing" soap:mustUnderstand="1">{msg.gateway.url.toString()}</wsa:To>
	<wsa:Action xmlns:wsa="http://www.w3.org/2005/08/addressing" soap:mustUnderstand="1">urn:ihe:iti:2007:CrossGatewayQuery</wsa:Action>
	<wsa:MessageID xmlns:wsa="http://www.w3.org/2005/08/addressing">{'urn:uuid:' + msg.id.toString()}</wsa:MessageID>
	<wsa:ReplyTo xmlns:wsa="http://www.w3.org/2005/08/addressing">
		<wsa:Address xmlns:wsa="http://www.w3.org/2005/08/addressing">http://www.w3.org/2005/08/addressing/anonymous</wsa:Address>
	</wsa:ReplyTo>
   </soap:Header>
   <soap:Body>
      <urn:AdhocQueryRequest id={channelMap.get('MSG_ID')} federated="false" startIndex="0" maxResults="-1">
         <urn:ResponseOption returnType="LeafClass" returnComposedObjects="true"/>
         <urn2:AdhocQuery id="urn:uuid:14d4debf-8f97-4251-9a74-a90016b0af0d" home={msg.gateway.homeCommunityId.toString()} lid="urn:oasis:names:tc:ebxml-regrep:query:AdhocQueryRequest" objectType="urn:oasis:names:tc:ebxml-regrep:xsd:rim:3.0" status="urn:oasis:names:tc:ebxml-regrep:xsd:rim:3.0"/>
      </urn:AdhocQueryRequest>
   </soap:Body>
</soap:Envelope>;

soap.*::Body.*::AdhocQueryRequest.*::AdhocQuery.appendChild(channelMap.get('PARAMLIST'));

channelMap.put('SOAP_REQUEST', soap.toString());
channelMap.put('URL', msg.gateway.url.toString());