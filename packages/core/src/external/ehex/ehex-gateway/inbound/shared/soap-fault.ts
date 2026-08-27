import { XMLBuilder } from "fast-xml-parser";
import { v4 as uuidv4 } from "uuid";
import { wrapIdInUrnUuid } from "../../../../../util/urn";
import { namespaces } from "../../constants";
import { SamlHeaderBase, TextOrTextObject } from "../../schema";
import { xmlBuilderAttributes } from "../../shared";

function getTextFromTextOrTextObject(textOrTextObject: TextOrTextObject): string {
  if (textOrTextObject && typeof textOrTextObject === "object") {
    return String(textOrTextObject._text);
  }
  return String(textOrTextObject);
}

/**
 * Creates a SOAP Fault message according to SOAP 1.2 specification.
 * Per eHex requirements (conveyed through email), we must return SOAP faults with
 * a header that includes the original MessageID and Action.
 *
 * @param header - WS-Addressing headers (MessageID, RelatesTo, Action) for correlation
 * @param faultString - Human-readable description of the fault
 * @param faultCode - SOAP fault code (default: "soap:Sender" for client errors)
 *   Use "soap:Sender" for client errors (e.g., schema validation failures)
 *   Use "soap:Receiver" for server errors (e.g., internal processing failures)
 * @param detail - Optional application-specific error information
 * @returns XML string containing the SOAP fault envelope
 */
export function createSoapFault({
  header,
  faultString,
  faultCode = "soap:Sender",
  detail,
}: {
  header: SamlHeaderBase;
  faultString: string;
  faultCode?: string;
  detail?: string;
}): string {
  const originalMessageId = getTextFromTextOrTextObject(header.MessageID);
  const newMessageId = wrapIdInUrnUuid(uuidv4());

  const soapFault = {
    "soap:Envelope": {
      "@_xmlns:soap": namespaces.soap,
      "@_xmlns:wsa": namespaces.wsa,
      "soap:Header": {
        "wsa:Action": {
          "@_mustUnderstand": "1",
          "#text": `${getTextFromTextOrTextObject(header.Action)}Fault`,
        },
        "wsa:MessageID": newMessageId,
        "wsa:RelatesTo": originalMessageId,
      },
      "soap:Body": {
        "soap:Fault": {
          "soap:Code": {
            "soap:Value": {
              "#text": faultCode,
            },
          },
          "soap:Reason": {
            "soap:Text": {
              "@_xml:lang": "en",
              "#text": faultString,
            },
          },
          ...(detail && {
            "soap:Detail": {
              "#text": detail,
            },
          }),
        },
      },
    },
  };

  const formattedBuilderAttributes = {
    ...xmlBuilderAttributes,
    format: true,
    indentBy: "  ",
  };
  const builder = new XMLBuilder(formattedBuilderAttributes);
  const xmlContent = builder.build(soapFault);
  const cleanedContent = xmlContent.replace(/&quot;/g, "");

  const xmlDeclaration = '<?xml version="1.0" encoding="UTF-8"?>';
  let finalContent = cleanedContent;

  if (!finalContent.startsWith(xmlDeclaration)) {
    finalContent = `${xmlDeclaration}\n\n${finalContent}`;
  } else {
    const afterDeclaration = finalContent.substring(xmlDeclaration.length);
    if (!afterDeclaration.startsWith("\n\n")) {
      finalContent = `${xmlDeclaration}\n\n${afterDeclaration.trimStart()}`;
    }
  }

  return finalContent;
}
