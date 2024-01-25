/**
	Generates a generic SOAP Fault message

	@param {String} text - error description text
	@return {Object} return default SOAP Fault message
*/
function getSOAPFault(text) {

	var soap = <soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope" xmlns:wsa="http://www.w3.org/2005/08/addressing">
				  <soap:Header>
				    <wsa:To soap:mustUnderstand="true">http://www.w3.org/2005/08/addressing/anonymous</wsa:To>
				    <wsa:Action soap:mustUnderstand="true"></wsa:Action>
				    <wsa:MessageID soap:mustUnderstand="true">{'urn:uuid:' + UUIDGenerator.getUUID()}</wsa:MessageID>
				    <wsa:RelatesTo soap:mustUnderstand="true"></wsa:RelatesTo>
				  </soap:Header>
				  <soap:Body>
				    <env:Fault xmlns:env="http://www.w3.org/2003/05/soap-envelope">
				      <env:Code>
				        <env:Value>env:Sender</env:Value>
				      </env:Code>
				      <env:Reason>
				        <env:Text xml:lang="en-US">{text.toString()}</env:Text>
				      </env:Reason>
				    </env:Fault>
				  </soap:Body>
				</soap:Envelope>;

	return soap;
}


/**
	Generates a generic SOAP message

	@return {Object} return default SOAP message
*/
function getSOAPTemplate() {

	var soap = <soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope" xmlns:wsa="http://www.w3.org/2005/08/addressing">
				  <soap:Header>
				    <wsa:To soap:mustUnderstand="true">http://www.w3.org/2005/08/addressing/anonymous</wsa:To>
				    <wsa:Action soap:mustUnderstand="true"></wsa:Action>
				    <wsa:MessageID soap:mustUnderstand="true">{'urn:uuid:' + UUIDGenerator.getUUID()}</wsa:MessageID>
				    <wsa:RelatesTo soap:mustUnderstand="true"></wsa:RelatesTo>
				  </soap:Header>
				  <soap:Body/>
				</soap:Envelope>;

	return soap;
}

