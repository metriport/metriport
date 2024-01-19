var soap = <soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope" xmlns:urn="urn:hl7-org:v3">
   <soap:Header>
	<wsa:To xmlns:wsa="http://www.w3.org/2005/08/addressing" soap:mustUnderstand="1">{msg.gateway.url.toString()}</wsa:To>
	<wsa:Action xmlns:wsa="http://www.w3.org/2005/08/addressing" soap:mustUnderstand="1">urn:hl7-org:v3:PRPA_IN201305UV02:CrossGatewayPatientDiscovery</wsa:Action>
	<wsa:MessageID xmlns:wsa="http://www.w3.org/2005/08/addressing">{'urn:uuid:' + msg.id.toString()}</wsa:MessageID>
	<wsa:ReplyTo xmlns:wsa="http://www.w3.org/2005/08/addressing">
		<wsa:Address xmlns:wsa="http://www.w3.org/2005/08/addressing">http://www.w3.org/2005/08/addressing/anonymous</wsa:Address>
	</wsa:ReplyTo>
   </soap:Header>
   <soap:Body/>
</soap:Envelope>;