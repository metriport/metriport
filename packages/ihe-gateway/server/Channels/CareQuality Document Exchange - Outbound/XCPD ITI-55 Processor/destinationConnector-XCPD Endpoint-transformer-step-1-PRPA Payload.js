// Generate PRPA_IN201305UV02 [Patient Registry Find Candidates Query] message
var receiver = getHL7v3Receiver(msg.gateway.oid.toString(), msg.gateway.url.toString());
var sender = getHL7v3Sender(configurationMap.get('HL7v3.Sender.OID'), configurationMap.get('HL7v3.Sender.Name'));
var prpa = getXCPDRequest(receiver, sender);

prpa.*::id.@root = configurationMap.get('HL7v3.Sender.OID');
prpa.*::id.@extension = msg.id.toString();
prpa.*::controlActProcess.*::queryByParameter.*::queryId.@root = configurationMap.get('HL7v3.Sender.OID');
prpa.*::controlActProcess.*::queryByParameter.*::queryId.@extension = msg.id.toString();
prpa.*::controlActProcess.*::queryByParameter.*::parameterList.appendChild(channelMap.get('PARAMLIST'));

// Append payload to SOAP Body
soap.*::Body.setChildren(prpa);

// Move the 'urn:hl7-org:v3' namespace declaration back to the payload
soap = soap.toString().replace(' xmlns:urn="urn:hl7-org:v3"', '');
soap = soap.replace('<urn:PRPA_IN201305UV02 ITSVersion="XML_1.0">', '<urn:PRPA_IN201305UV02 ITSVersion="XML_1.0" xmlns:urn="urn:hl7-org:v3">');

channelMap.put('SOAP_REQUEST', soap.toString());
channelMap.put('URL', msg.gateway.url.toString());