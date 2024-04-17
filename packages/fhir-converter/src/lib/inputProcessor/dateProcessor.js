const { XMLParser } = require("fast-xml-parser");

/**
 * Extracts the effective time period (low and high) from the given XML data.
 * @param {string} srcData - The XML data as a string.
 * @returns {Object} An object containing the low and high values of the effective time period.
 */
function extractEncounterTimePeriod(srcData) {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "",
    parseAttributeValue: false,
    removeNSPrefix: true,
  });
  const jsonObj = parser.parse(srcData);
  const effectiveTime = jsonObj.ClinicalDocument.documentationOf.serviceEvent.effectiveTime;
  const low = effectiveTime.low;
  const high = effectiveTime.high;
  return { low, high };
}

module.exports.extractEncounterTimePeriod = extractEncounterTimePeriod;