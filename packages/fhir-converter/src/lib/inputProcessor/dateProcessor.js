const { XMLParser } = require("fast-xml-parser");
var { v4: uuidv4 } = require("uuid");
const { convertDate } = require("../handlebars-converter/handlebars-helpers").internal;

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  parseAttributeValue: false,
  removeNSPrefix: true,
});

/**
 * Extracts the effective time period (low and high) from the given XML data.
 * @param {string} srcData - The XML data as a string.
 * @returns {Object} An object containing the low and high values of the effective time period.
 */
function extractEncounterTimePeriod(srcData) {
  const jsonObj = parser.parse(srcData);
  const doc = jsonObj.ClinicalDocument;
  const encEncounterTime = doc?.componentOf?.encompassingEncounter?.effectiveTime;

  if (encEncounterTime) {
    return {
      low: encEncounterTime.low,
      high: encEncounterTime.high,
    };
  }

  const serviceEventTimeRaw =
    jsonObj.ClinicalDocument?.documentationOf?.serviceEvent?.effectiveTime;

  const birthTime = doc?.recordTarget?.patientRole?.patient?.birthTime?.value;
  if (serviceEventTimeRaw && birthTime) {
    const patientDob = convertDate(birthTime);

    const serviceTimeLowRaw = serviceEventTimeRaw.low?.value;
    const serviceTimeHighRaw = serviceEventTimeRaw.high?.value;

    let low = undefined;
    if (serviceTimeLowRaw) {
      const serviceEventTimeLow = convertDate(serviceTimeLowRaw);
      if (serviceEventTimeLow && patientDob !== serviceEventTimeLow) {
        low = serviceEventTimeRaw.low;
      }
    }

    let high = undefined;
    if (serviceTimeHighRaw) {
      const serviceEventTimeHigh = convertDate(serviceTimeHighRaw);
      if (serviceEventTimeHigh && patientDob !== serviceEventTimeHigh) {
        high = serviceEventTimeRaw.high;
      }
    }

    return { low, high };
  } else if (serviceEventTimeRaw) {
    return serviceEventTimeRaw;
  }

  return { low: undefined, high: undefined };
}

/**
 * Checks whether the given XML data contains an encompassing encounter, and returns a IDs for it.
 * Otherwise, returns undefined.
 * @param {string} srcData - The XML data as a string.
 * @returns {string} Returns an object containing the new UUID and external ID of the encompassing encounter.
 */
function getEncompassingEncounterId(srcData) {
  const jsonObj = parser.parse(srcData);
  const encompassingEncounter = jsonObj.ClinicalDocument?.componentOf?.encompassingEncounter;
  if (encompassingEncounter && encompassingEncounter.id) {
    const extIdRef = encompassingEncounter.id;
    const externalId = {
      ...(extIdRef.root && { root: extIdRef?.root }),
      ...(extIdRef.extension && { extension: extIdRef?.extension }),
    };
    return {
      newId: uuidv4(),
      externalId,
    };
  }
  return undefined;
}

module.exports.extractEncounterTimePeriod = extractEncounterTimePeriod;
module.exports.getEncompassingEncounterId = getEncompassingEncounterId;
