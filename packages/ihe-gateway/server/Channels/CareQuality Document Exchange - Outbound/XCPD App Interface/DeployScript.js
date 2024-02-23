// This script executes once when the channel is deployed
// You only have access to the globalMap and globalChannelMap here to persist data

// Store for the XCPD ITI-55 Processor
globalMap.put('XCPDAPPINTERFACE', channelId);

const baseAddress = globalMap.get("API_BASE_ADDRESS");
if (!baseAddress) {
  logger.error("XCPD App Interface: Failed start, missing API_BASE_ADDRESS");
  ChannelUtil.stopChannel(channelId);
  return;
}

const destinationURL = baseAddress + "/internal/carequality/patient-discovery/response";
globalChannelMap.put("URL", destinationURL);

return;