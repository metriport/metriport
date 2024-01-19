// This script executes once when the channel is deployed
// You only have access to the globalMap and globalChannelMap here to persist data


// Instantiate and store HAPI FHIR IParser interface
try {
	
	var ctx = Packages.ca.uhn.fhir.context.FhirContext.forR4();
	var parser = ctx.newXmlParser();
	if (ctx && parser) {
		globalChannelMap.put('FHIRCONTEXT', ctx);
		globalChannelMap.put('PARSER', parser);
	} else {
		logger.error('XCPD Inbound Processor: Failed to create HAPI FHIR classes');
		ChannelUtil.stopChannel(channelId);
	}
	
} catch(ex) {
	logger.error('XCPD Inbound Processor: Failed to cache HAPI FHIR Parser - ' + ex.toString());
	ChannelUtil.stopChannel(channelId);
}


return;