// If both successes and failures are received from Responding Gateways, the Initiating Gateway shall return both DocumentResponse and
// RegistryErrorList elements in one response and specify PartialSuccess status.
if ('Success' == queryResponseCode.toString() || 'PartialSuccess' == queryResponseCode.toString()) {

	if (xml.*::DocumentResponse.length() > 0) try {

		var bucketName = Config.getS3BucketName();
    var bucketRegion = globalMap.get('REGION');
		var request = channelMap.get('REQUEST');
		var contentList = [];
		var operationOutcome = null;
		channelMap.put('RESULT', '0 doc');
		// Process possible errors
		if (xml.*::RegistryResponse.*::RegistryErrorList.length() > 0) try {
			operationOutcome = processRegistryErrorList(xml.*::RegistryResponse.*::RegistryErrorList);
		} catch(ex) {
			if (globalMap.containsKey('TEST_MODE')) logger.error('XCA ITI-39 Processor: Response (Case1) - ' + ex);
			channelMap.put('RESPONSE_PROCESSING_ERROR_CASE1_STEP1', ex.toString());
		}

		// MetriportID mapping
		var idMapping = {};
		request.documentReference.forEach(function(entry) {
			idMapping[entry.docUniqueId.toString()] = entry.metriportId.toString();
		});

		// Process retrieved documents
		for each (var entry in xml.*::DocumentResponse) {

			try {
				var attachment = {};
				attachment.homeCommunityId = entry.*::HomeCommunityId.toString().replace('urn:oid:', '');
				attachment.repositoryUniqueId = entry.*::RepositoryUniqueId.toString().replace('urn:uuid:', '');
				attachment.docUniqueId = entry.*::DocumentUniqueId.toString().replace('urn:uuid:', '');
				attachment.metriportId = idMapping[attachment.docUniqueId.toString()];
				attachment.fileLocation = bucketName;

				var logError = (ex) => {
					logger.error("Error decoding doc - docUniqueId: " + attachment.docUniqueId + "; metriportId: " +
						attachment.metriportId + "; " + ex);
				};

				// Responding Gateways which support the Persistence of Retrieved Documents Option shall specify the NewRepositoryUniqueId element
				// indicating the document is available for later retrieval and be able to return exactly the same document in all future retrieve
				// requests for the document identified by NewDocumentUniqueId.
				var newRepositoryUniqueId = entry.*::NewRepositoryUniqueId.toString();
				if (newRepositoryUniqueId) attachment.newRepositoryUniqueId = newRepositoryUniqueId.toString();

				var newDocumentUniqueId = entry.*::NewDocumentUniqueId.toString();
				if (newDocumentUniqueId) attachment.newDocumentUniqueId = newDocumentUniqueId.toString();

				var documentEncoded = entry.*::Document;
				var parsedFile = parseFileFromString(documentEncoded, false);
				var detectedExtension = parsedFile.extension;
				var detectedFileType = parsedFile.mimeType;
				var decodedAsString = parsedFile.decodedString;
				var decodedBytes = parsedFile.decodedBytes;

				// Files are stored in format: <CX_ID>/<PATIENT_ID>/<CX_ID>_<PATIENT_ID>_<DOC_ID>.<extension>
				var fileName = [request.cxId, request.patientId, attachment.metriportId + detectedExtension].join('_');
				var filePath = [request.cxId, request.patientId, fileName].join('/');
				// TODO 1350 Create a function to get the attributes using getObjectAttributes() - this is returning the whole file!
				// https://sdk.amazonaws.com/java/api/latest/software/amazon/awssdk/services/s3/S3Client.html#getObjectAttributes(software.amazon.awssdk.services.s3.model.GetObjectAttributesRequest)
        var filePathString = filePath.toString();
				var docExists = fileExistsOnS3(filePathString);
        var url = "https://" + bucketName + ".s3."  + bucketRegion + ".amazonaws.com/" + filePathString;

				attachment.fileName = filePathString;
				attachment.url = url;
				attachment.isNew = !docExists
				attachment.contentType = detectedFileType;

				// Parse the document header for some metadata
				try {
					if (detectedFileType === XML_TXT_MIME_TYPE || detectedFileType === XML_APP_MIME_TYPE) {
						var firstTitle = decodedAsString.split("<title>")[1];
						if (firstTitle) {
							var title = firstTitle.split("</title>")[0];
							if (title) attachment.title = title;
						}
					}
					var fileSize = decodedBytes.length;
					if (fileSize) attachment.size = parseInt(fileSize);
				} catch (ex) {
					logError(ex);
				}

				var resultFromS3 = xcaWriteToFile(filePathString, decodedBytes, attachment);
				contentList.push(attachment);

				// TODO 1350 remove this log
				logger.info("[XCA ITI-39 Processor] File stored on S3 (" + filePathString + "): " + resultFromS3.toString());

			} catch(ex) {
        logger.info('error' + ex);
				var issue = {
					 "severity": "fatal",
					 "code": "processing",
					 "details": {"text": ""}
				};
				issue.details.text = ex.toString();
				if (!operationOutcome) operationOutcome = getOperationOutcome(channelMap.get('MSG_ID'));
				operationOutcome.issue.push(issue);
			}
		}
		try {
			if (operationOutcome) channelMap.put('OperationOutcome', JSON.stringify(operationOutcome));
		} catch (ex) {
			logger.error('Error setting OperationOutcome: ' + ex);
		}

		// TODO: Process and generate OperationOutcome
		if (contentList.length > 0) {
			channelMap.put('RESULT', contentList.length + ' doc(s)');
			var _response = getXCA39ResponseTemplate(channelMap.get('REQUEST'), operationOutcome);
			_response.documentReference = contentList;
			var result = router.routeMessageByChannelId(globalMap.get('XCADRAPPINTERFACE'), JSON.stringify(_response));
		}

	} catch(ex) {
		if (globalMap.containsKey('TEST_MODE')) logger.error('XCA ITI-39 Processor: Response (Case1) - ' + ex);
		channelMap.put('RESPONSE_PROCESSING_ERROR_CASE1_STEP3', ex.toString());
		throw ex;
	}

	// Stop further processing
	return;
}