// Generate PRPA_IN201305UV02 [Patient Registry Find Candidates Query] message
const senderOID = Config.getHomeCommunityId();
const senderNamme = Config.getHomeCommunityName();
const receiver = getHL7v3Receiver(msg.gateway.oid.toString(), msg.gateway.url.toString());
const sender = getHL7v3Sender(senderOID, senderNamme);
const prpa = getXCPDRequest(receiver, sender);

prpa.*::id.@root = senderOID;
prpa.*::id.@extension = msg.id.toString();
prpa.*::controlActProcess.*::queryByParameter.*::queryId.@root = senderOID;
prpa.*::controlActProcess.*::queryByParameter.*::queryId.@extension = msg.id.toString();
prpa.*::controlActProcess.*::queryByParameter.*::parameterList.appendChild(channelMap.get('PARAMLIST'));

// Append payload to SOAP Body
soap.*::Body.setChildren(prpa);

// Move the 'urn:hl7-org:v3' namespace declaration back to the payload
soap = soap.toString().replace(' xmlns:urn="urn:hl7-org:v3"', '');
soap = soap.replace('<urn:PRPA_IN201305UV02 ITSVersion="XML_1.0">', '<urn:PRPA_IN201305UV02 ITSVersion="XML_1.0" xmlns:urn="urn:hl7-org:v3">');

channelMap.put('SOAP_REQUEST', soap.toString());
channelMap.put('URL', msg.gateway.url.toString());