// Process simple SOAP or MTOM responses
if (channelMap.containsKey('MTOM')) {
	logger.info('XCA Inbound Interface: ITI-39 response processing - MTOM response');

	// MTOM response with Base64 encoded document contents as separate attachments
	var uuid = String(UUIDGenerator.getUUID()).replace(/-/g, '');
	
	var multipart = new ResponseMultipartSettings();
	multipart.addBodyHeader('Content-Type', 'application/xop+xml; charset=UTF-8; type="application/soap+xml"');
	multipart.addBodyHeader('Content-Transfer-Encoding', 'binary');
	multipart.addBodyHeader('Content-ID', '<doc0@metriport.com>');
	multipart.setBoundary('--MIMEBoundary' + uuid);


	var soapTemplate = getSOAPTemplate();
	var soap = soapTemplate.namespace('soap');
	var wsa = soapTemplate.namespace('wsa');
	soapTemplate.soap::Header.wsa::Action = 'urn:ihe:iti:2007:CrossGatewayRetrieveResponse';
	soapTemplate.soap::Header.wsa::RelatesTo = 'urn:uuid:' + channelMap.get('MSG_ID');
	var _response = getXCAITI39QueryResponse(msg, operationOutcome, channelMap.containsKey('MTOM'))

	soapTemplate.*::Body.appendChild(_response);
	logger.info("_response" + _response)

	
	try {
		for each (var doc in soapTemplate.*::Body.*::RetrieveDocumentSetResponse.*::RegistryResponse.*::DocumentResponse) {

			var ihe = doc.namespace('ihe');
			
			logger.info("doc" + doc)
			var attachment = doc.ihe::Document.toString().split(':');

			logger.info("attachment" + attachment)
			var attachmentId = String(attachment[3]).slice(0, -1);

			logger.info("attachment" + attachment)
			logger.info("attachmentId" + attachmentId)
	
			var mtomAttachment = new ResponseMultipartAttachment(attachmentId);
			mtomAttachment.setChannelId(attachment[1]);
			mtomAttachment.setMessageId(parseInt(attachment[2]));
			mtomAttachment.setAttachmentId(attachmentId);
			mtomAttachment.setHeader('Content-Type', doc.ihe::mimeType.toString());
			mtomAttachment.setHeader('Content-Transfer-Encoding', 'binary');
			mtomAttachment.setHeader('Content-ID', '<' + doc.ihe::DocumentUniqueId + '>');
			multipart.getAttachments().add(mtomAttachment);

			
			doc.ihe::Document = '';
			var xop = <xop:Include xmlns:xop="http://www.w3.org/2004/08/xop/include" href={'cid:' + doc.*::DocumentUniqueId}/>;
			doc.ihe::Document.appendChild(xop);
		}
	} catch(ex) {
		if (globalMap.containsKey('TEST_MODE')) logger.error('XCA Inbound Interface: ITI-39 response processing - ' + ex);
		throw ex;
	}

	// SN: Undocumented Mirth XCA Interop feature
	channelMap.put('responseMultipartSettings', multipart);
	responseMap.put('RESPONSE', msg.toString());

} else {
	// Simple SOAP response with Base64 encoded documents inline
	var result = AttachmentUtil.reAttachMessage(msg.toString(), connectorMessage);
	responseMap.put('RESPONSE', result.toString());
}
