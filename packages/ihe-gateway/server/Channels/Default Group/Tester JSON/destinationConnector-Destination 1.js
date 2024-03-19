logger.info("[Tester] Running...");

const payload = channelMap.get("REQ_BODY");

const result = JSON.stringify(payload);
logger.info("[Tester] Got this: " + result);

logger.info("[Tester] Returning...");
return result;
