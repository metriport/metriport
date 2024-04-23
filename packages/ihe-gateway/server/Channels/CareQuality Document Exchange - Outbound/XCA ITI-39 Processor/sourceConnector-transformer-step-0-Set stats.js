// Store internal message id
channelMap.put('MSG_ID', msg.id.toString());
channelMap.put('CUSTOMER_ID', msg.cxId.toString());
channelMap.put('REQUEST_TIME', getCurrentDate());
// Store for further processing
channelMap.put('REQUEST', msg);