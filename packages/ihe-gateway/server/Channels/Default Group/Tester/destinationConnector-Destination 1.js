const payload = channelMap.get("REQ_BODY");
const result = JSON.stringify(payload);

const logIt = () => {
	logger.info("[Tester] Got this2: " + result);
}

logger.info("[Tester] Running...");

logIt();

logger.info("[Tester] Returning...");
return result;
