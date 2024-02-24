// This script executes once when the channel is deployed
// You only have access to the globalMap and globalChannelMap here to persist data

// Store for the XCA ITI-39 Processors
globalMap.put("XCADRAPPINTERFACE", channelId);

const baseAddress = globalMap.get("API_BASE_ADDRESS");
if (!baseAddress) {
  logger.error("XCA - DR App Interface: Failed start, missing API_BASE_ADDRESS");
  ChannelUtil.stopChannel(channelId);
  return;
}

const destinationURL = baseAddress + "/internal/carequality/document-retrieval/response";
globalChannelMap.put("URL", destinationURL);

return;
