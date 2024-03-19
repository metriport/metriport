/**
	Decodes a base64 string.

	@param {Object} value - the base64 string
	@return {Object} base 64 decoded string
*/
function decodeBase64(value) {
	return new java.lang.String(com.mirth.connect.server.userutil.FileUtil.decode(value), "UTF-8")
}

/**
	Parse and decodes JSON from the HTTP request

	@param {Object} msg - incoming msg object
	@return {Object} return extracted JSON object
*/
function getBase64Content(msg) {

	let base64 = null, json = null;

	if (msg.hasOwnProperty('Content')) try {
		
		// Extract the Base64 encoded HTTP Content
		if ('Base64' == msg.Content.@encoding.toString()) {
			base64 = decodeBase64(msg.Content.toString());
		} else {
			base64 = msg.Content.toString();
		}

		// Validate by creating JSON object
		json = JSON.parse(base64.toString());
		
	} catch(ex) {
		if (globalMap.containsKey('TEST_MODE')) logger.error('Code Template: getBase64Content() - ' + ex);
		return ex.toString();
	}

	return json;
}


/**
	Parse and decodes XML from the HTTP content

	@param {Object} msg - incoming msg object
	@return {Object} return extracted XML object
*/
function getBase64Body(msg) {

	let xml = null;

	if (msg.hasOwnProperty('Body')) try {
		
		// Extract the Base64 encoded HTTP Body
		if ('Base64' == msg.Body.@encoding.toString()) {
			xml = decodeBase64(msg.Body.toString());
		} else {
			xml = msg.Body.toString();
		}

		// Validate by creating XML object
		xml = new XML(xml);
		
	} catch(ex) {
		return ex.toString();
	}

	return xml;
}