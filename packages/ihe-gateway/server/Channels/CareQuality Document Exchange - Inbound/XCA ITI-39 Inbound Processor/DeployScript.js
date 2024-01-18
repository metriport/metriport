// This script executes once when the channel is deployed
// You only have access to the globalMap and globalChannelMap here to persist data


globalChannelMap.put('XCA39INBOUNDPROCESSOR', channelId);

if (!globalMap.containsKey('ACCESS_KEY') || !globalMap.containsKey('SECRET_KEY')) {
	ChannelUtil.stopChannel(channelId);
}

return;