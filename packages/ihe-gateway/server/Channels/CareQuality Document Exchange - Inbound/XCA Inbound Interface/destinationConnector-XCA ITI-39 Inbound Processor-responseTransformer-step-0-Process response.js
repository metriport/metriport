// Process simple SOAP or MTOM responses

if (channelMap.containsKey('MTOM')) {

	// MTOM response with Base64 encoded document contents as separate attachments
	var uuid = String(UUIDGenerator.getUUID()).replace(/-/g, '');
	
	var multipart = ResponseMultipartSettings();
	multipart.addBodyHeader('Content-Type', 'application/xop+xml; charset=UTF-8; type="application/soap+xml"');
	multipart.addBodyHeader('Content-Transfer-Encoding', 'binary');
	multipart.addBodyHeader('Content-ID', '<doc0@metriport.com>');
	multipart.setBoundary('--MIMEBoundary' + uuid);

	var multipartAttachmentList = [];


	try {
		for each (var doc in msg.*::Body.*::RetrieveDocumentSetResponse.*::RegistryResponse.*::DocumentResponse) {

			var ihe = doc.namespace('ihe');
			
			var attachment = doc.ihe::Document.toString().split(':');
			var attachmentId = String(attachment[3]).slice(0, -1);
	
			var mtomAttachment = ResponseMultipartAttachment();
			mtomAttachment.setChannelId(attachment[1]);
			mtomAttachment.setMessageId(parseInt(attachment[2]));
			mtomAttachment.setAttachmentId(attachmentId);
			mtomAttachment.setHeader('Content-Type', doc.ihe::mimeType.toString());
			mtomAttachment.setHeader('Content-Transfer-Encoding', 'binary');
			mtomAttachment.setHeader('Content-ID', '<' + doc.ihe::DocumentUniqueId + '>');
			multipartAttachmentList.push(mtomAttachment);
			
			doc.ihe::Document = '';
			var xop = <xop:Include xmlns:xop="http://www.w3.org/2004/08/xop/include" href={'cid:' + doc.*::DocumentUniqueId}/>;
			doc.ihe::Document.appendChild(xop);
		}
	} catch(ex) {
		if (globalMap.containsKey('TEST_MODE')) logger.error('XCA Inbound Interface: ITI-39 response processing - ' + ex);
	}

	multipart.setAttachments(multipartAttachmentList);

	// SN: Undocumented Mirth XCA Interop feature
	channelMap.put('responseMultipartSettings', multipart);
	responseMap.put('XCA_RESPONSE', msg.toString());

} else {
	// Simple SOAP response with Base64 encoded documents inline
	var result = AttachmentUtil.reAttachMessage(msg.toString(), connectorMessage);
	responseMap.put('XCA_RESPONSE', result.toString());
}