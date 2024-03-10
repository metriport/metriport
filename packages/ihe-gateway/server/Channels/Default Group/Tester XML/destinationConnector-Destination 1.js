logger.info("[Tester] Running...");

const msg = channelMap.get("REQ_BODY");

logger.info("[Tester] Got: " + msg.toString());

const res = parseFileFromString(msg.toString());
logger.info("[Tester] >>> res: " + JSON.stringify(res));

const fileName = new Date().toISOString();
const s3Res = xcaWriteToFile("nonXMLBody/" + fileName + res.extension, res.decodedBytes, {});

logger.info("[Tester] Returning...");
return xml;
