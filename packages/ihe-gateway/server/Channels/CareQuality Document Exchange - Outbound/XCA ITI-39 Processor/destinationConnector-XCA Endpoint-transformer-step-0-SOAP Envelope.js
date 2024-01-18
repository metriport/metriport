var soap = <soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope" xmlns:urn="urn:ihe:iti:xds-b:2007">
   <soap:Header>
	<wsa:To xmlns:wsa="http://www.w3.org/2005/08/addressing" soap:mustUnderstand="1">{msg.gateway.url.toString()}</wsa:To>
	<wsa:Action xmlns:wsa="http://www.w3.org/2005/08/addressing" soap:mustUnderstand="1">urn:ihe:iti:2007:CrossGatewayRetrieve</wsa:Action>
	<wsa:MessageID xmlns:wsa="http://www.w3.org/2005/08/addressing">{'urn:uuid:' + msg.id.toString()}</wsa:MessageID>
	<wsa:ReplyTo xmlns:wsa="http://www.w3.org/2005/08/addressing">
		<wsa:Address xmlns:wsa="http://www.w3.org/2005/08/addressing">http://www.w3.org/2005/08/addressing/anonymous</wsa:Address>
	</wsa:ReplyTo>
   </soap:Header>
   <soap:Body>
      <urn:RetrieveDocumentSetRequest/>
   </soap:Body>
</soap:Envelope>;

soap.*::Body.*::RetrieveDocumentSetRequest.appendChild(channelMap.get('PARAMLIST'));
channelMap.put('SOAP_REQUEST', soap.toString());
channelMap.put('URL', msg.gateway.url.toString());