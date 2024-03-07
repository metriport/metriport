// This script executes once when the channel is deployed
// You only have access to the globalMap and globalChannelMap here to persist data

const msg = "XCA-ITI-39 Inbound Processor: Failed start, missing";
if (!globalMap.containsKey("ACCESS_KEY")) {
  logger.error(msg + " ACCESS_KEY");
  ChannelUtil.stopChannel(channelId);
}
if (!globalMap.containsKey("SECRET_KEY")) {
  logger.error(msg + " SECRET_KEY");
  ChannelUtil.stopChannel(channelId);
}

return;
