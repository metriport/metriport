// This script executes once when the channel is deployed
// You only have access to the globalMap and globalChannelMap here to persist data

// Store for the XCA ITI-38 and ITI-39 Processors
globalMap.put("XCADQAPPINTERFACE", channelId);

const baseAddress = globalMap.get("API_BASE_ADDRESS");
if (!baseAddress) {
  logger.error("XCA - DQ App Interface: Failed start, missing API_BASE_ADDRESS");
  ChannelUtil.stopChannel(channelId);
  return;
}

const destinationURL = baseAddress + "/internal/carequality/document-query/response";
globalChannelMap.put("URL", destinationURL);

return;
