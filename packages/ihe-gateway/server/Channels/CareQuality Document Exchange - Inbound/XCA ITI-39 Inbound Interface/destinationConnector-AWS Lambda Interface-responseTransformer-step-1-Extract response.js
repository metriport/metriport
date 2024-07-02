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

	var _response = getXCAITI39QueryResponse(msg, operationOutcome, channelMap.containsKey('MTOM'))

	soapTemplate.*::Body.appendChild(_response);
	logger.info("soapTemplate.*::Body" + soapTemplate.*::Body)
	logger.info("soapTemplate.*::Body.*::RetrieveDocumentSetResponse" + soapTemplate.*::Body.*::RetrieveDocumentSetResponse)

	
	try {
		for each (var doc in soapTemplate.*::Body.*::RetrieveDocumentSetResponse.*::DocumentResponse) {

			var ihe = doc.namespace('ihe');
			
			logger.info("doc" + doc)
			var attachment = doc.*::Document.toString();
			var attachmentContentType = doc.*::mimeType.toString();

			logger.info("attachment" + attachment)
			var attachmentId = addAttachment(attachment, attachmentContentType, true).getId();

			logger.info("attachmentId" + attachmentId)
	
			var mtomAttachment = new ResponseMultipartAttachment(attachmentId);
			mtomAttachment.setHeader('Content-Type', doc.*::mimeType.toString());
			mtomAttachment.setHeader('Content-Transfer-Encoding', 'binary');
			mtomAttachment.setHeader('Content-ID', '<' + doc.*::DocumentUniqueId + '>');

			logger.info("mtomAttachment" + mtomAttachment)
			multipart.getAttachments().add(mtomAttachment);

			
			doc.*::Document = '';
			var xop = <xop:Include xmlns:xop="http://www.w3.org/2004/08/xop/include" href={'cid:' + doc.*::DocumentUniqueId}/>;
			doc.*::Document.appendChild(xop);
		}
	} catch(ex) {
		if (globalMap.containsKey('TEST_MODE')) logger.error('XCA Inbound Interface: ITI-39 response processing - ' + ex);
		throw ex;
	}

	// SN: Undocumented Mirth XCA Interop feature
	channelMap.put('responseMultipartSettings', multipart);
	responseMap.put('RESPONSE', soapTemplate.toString());

} else {
	// Simple SOAP response with Base64 encoded documents inline
	var result = AttachmentUtil.reAttachMessage(msg.toString(), connectorMessage);
	responseMap.put('RESPONSE', result.toString());
}
