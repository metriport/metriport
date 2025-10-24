export const xmlTranslationCodeRegex = /(<translation[^>]*\scode=")([^"]*?)(")/g;

export const LESS_THAN = "&lt;";
export const GREATER_THAN = "&gt;";
const AMPERSAND = "&amp;";
const UNESCAPED_AMPERSAND_REGEX =
  /&(?!((?:lt|gt|amp|quot|apos|nbsp|ndash|mdash|copy|reg|trade|bullet);|#[0-9]+;|#x[0-9A-Fa-f]+;))/g;

export function cleanUpPayload(payloadRaw: string): string {
  const payloadNoCdUnk = replaceCdUnkString(payloadRaw);
  const payloadNoAmpersand = replaceAmpersand(payloadNoCdUnk);
  const payloadNoInvalidTagChars = replaceXmlTagChars(payloadNoAmpersand);
  const payloadNoNullFlavor = replaceNullFlavor(payloadNoInvalidTagChars);
  const payloadCleanedCode = cleanUpTranslationCode(payloadNoNullFlavor);
  return payloadCleanedCode;
}

export function replaceCdUnkString(payloadRaw: string): string {
  const stringToReplace = /xsi:type="CD UNK"/g;
  const replacement = `xsi:type="CD"`;
  return payloadRaw.replace(stringToReplace, replacement);
}

export function replaceNullFlavor(payloadRaw: string): string {
  return payloadRaw.replace(/<id\b[^>]*\bnullFlavor\s*=\s*"[^"]*"[^>]*>/gi, match => {
    if (match.includes("root") || match.includes("extension")) return match;
    const isSelfClosing = /\/\s*>$/.test(match);
    return isSelfClosing ? '<id extension="1" root="1"/>' : '<id extension="1" root="1">';
  });
}

export function replaceAmpersand(payloadRaw: string): string {
  return payloadRaw.replace(UNESCAPED_AMPERSAND_REGEX, AMPERSAND);
}

export function replaceXmlTagChars(doc: string): string {
  const chars = Array.from(doc);

  let stringState = true;
  let startTagState = 0;
  let tagPropertiesState = false;
  let inComment = false;

  for (let i = 0; i < chars.length; i++) {
    const c = chars[i];

    // Check for comment start "<!--"
    if (!inComment && c === "<" && i + 3 < chars.length) {
      if (chars[i + 1] === "!" && chars[i + 2] === "-" && chars[i + 3] === "-") {
        inComment = true;
        i += 3; // Skip the next 3 characters
        continue;
      }
    }

    // Check for comment end "-->"
    if (inComment && c === "-" && i + 2 < chars.length) {
      if (chars[i + 1] === "-" && chars[i + 2] === ">") {
        inComment = false;
        i += 2; // Skip the next 2 characters
        continue;
      }
    }

    // Skip processing if we're inside a comment
    if (inComment) {
      continue;
    }

    if (stringState) {
      if (c == ">") {
        chars[i] = "&gt;";
      } else if (c == "<") {
        stringState = false;
        startTagState = i;
      }
    }
    // tag state
    else {
      if (c == '"') {
        tagPropertiesState = !tagPropertiesState;
      }
      if (c == ">") {
        if (tagPropertiesState) {
          chars[i] = "&gt;";
        } else {
          stringState = true;
        }
      } else if (c == "<") {
        if (tagPropertiesState && i != startTagState) {
          chars[i] = "&lt;";
        } else {
          chars[startTagState] = "&lt;";
          startTagState = i;
        }
      }
    }
  }
  return chars.join("");
}

export function cleanUpTranslationCode(payloadRaw: string): string {
  return payloadRaw.replace(xmlTranslationCodeRegex, (_, prefix, code, suffix) => {
    const cleanedCode = code.split("\\")[0].trim();
    return `${prefix}${cleanedCode}${suffix}`;
  });
}
