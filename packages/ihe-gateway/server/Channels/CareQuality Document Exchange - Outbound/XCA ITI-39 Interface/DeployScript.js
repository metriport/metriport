// This script executes once when the channel is deployed
// You only have access to the globalMap and globalChannelMap here to persist data

// Store for the XCPD Bulk Interface
globalMap.put('XCAITI39Interface', channelId);

if (!globalMap.containsKey('ACCESS_KEY') || !globalMap.containsKey('SECRET_KEY')) {
	ChannelUtil.stopChannel(channelId);
}

return;