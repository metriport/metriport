// -------------------------------------------------------------------------------------------------
// Copyright (c) 2022-present Metriport Inc.
//
// Licensed under AGPLv3. See LICENSE in the repo root for license information.
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//     Copyright (c) Microsoft Corporation. All rights reserved.
//
//     Permission to use, copy, modify, and/or distribute this software
//     for any purpose with or without fee is hereby granted, provided
//     that the above copyright notice and this permission notice appear
//     in all copies.
//
//     THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL
//     WARRANTIES WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED
//     WARRANTIES OF MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE
//     AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT, INDIRECT, OR
//     CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS
//     OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT,
//     NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR IN
//     CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
// -------------------------------------------------------------------------------------------------

var uuidv3 = require("uuid/v3");
var HandlebarsUtils = require("handlebars").Utils;
var constants = require("../constants/constants");
var fs = require("fs");
var crypto = require("crypto");
var jsonProcessor = require("../outputProcessor/jsonProcessor");
var specialCharProcessor = require("../inputProcessor/specialCharProcessor");
var zlib = require("zlib");
const he = require("he");
const convert = require("convert-units");

const PERSONAL_RELATIONSHIP_TYPE_CODE = "2.16.840.1.113883.1.11.19563";
const decimal_regex = /-?(?:(?:0|[1-9][0-9]*)\.?[0-9]*|\.[0-9]+)(?:[eE][+-]?[0-9]+)?/;
const DECIMAL_REGEX_STR = decimal_regex.toString().slice(1, -1);

/**
 * Based on the following template:
 * - ValueSet/SystemReference.hbs
 *
 * @warning - If you are updating this, please also update the ValueSet/SystemReference.hbs template definition.
 */
const SYSTEM_URL_MAP = {
  "2.16.840.1.113883.6.1": "http://loinc.org",
  "2.16.840.1.113883.6.96": "http://snomed.info/sct",
  "2.16.840.1.113883.6.88": "http://www.nlm.nih.gov/research/umls/rxnorm",
  "2.16.840.1.113883.6.69": "http://hl7.org/fhir/sid/ndc",
  "2.16.840.1.113883.3.88.12.3221.8.9": "http://snomed.info/sct",
  "2.16.840.1.113883.5.83": "http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation",
  "2.16.840.1.113883.4.1": "http://hl7.org/fhir/sid/us-ssn",
  "2.16.840.1.113883.4.6": "http://hl7.org/fhir/sid/us-npi",
  "2.16.840.1.113883.4.572": "http://hl7.org/fhir/sid/us-medicare",
  "2.16.840.1.113883.4.927": "http://hl7.org/fhir/sid/us-mbi",
  "2.16.840.1.113883.12.292": "http://hl7.org/fhir/sid/cvx",
  "2.16.840.1.113883.6.59": "http://terminology.hl7.org/2.1.0/CodeSystem-CVX",
  "2.16.840.1.113883.6.101": "http://nucc.org/provider-taxonomy",
  "2.16.840.1.113883.2.20.5.1": "http://fhir.infoway-inforoute.ca/CodeSystem/pCLOCD",
  "2.16.840.1.113883.6.8": "http://unitsofmeasure.org",
  "2.16.840.1.113883.6.12": "http://www.ama-assn.org/go/cpt",
  "2.16.840.1.113883.6.345": "http://va.gov/terminology/medrt",
  "2.16.840.1.113883.6.209": "http://hl7.org/fhir/ndfrt",
  "2.16.840.1.113883.4.9": "http://fdasis.nlm.nih.gov",
  "2.16.840.1.113883.6.24": "urn:iso:std:iso:11073:10101",
  "2.16.840.1.113883.6.103": "http://terminology.hl7.org/CodeSystem/ICD-9CM-diagnosiscodes",
  "2.16.840.1.113883.6.104": "http://terminology.hl7.org/CodeSystem/ICD-9CM-procedurecodes",
  "2.16.840.1.113883.6.90": "http://hl7.org/fhir/sid/icd-10-cm",
  "2.16.840.1.113883.6.4": "http://www.cms.gov/Medicare/Coding/ICD10",
  "2.16.840.1.113883.6.238": "http://terminology.hl7.org/CodeSystem-CDCREC.html",
  "2.16.840.1.113883.6.208": "http://terminology.hl7.org/CodeSystem/nddf",
  "2.16.840.1.113883.5.4": "http://terminology.hl7.org/CodeSystem/v3-ActCode",
  "2.16.840.1.113883.3.26.1.1": "http://ncicb.nci.nih.gov/xml/owl/EVS/Thesaurus.owl",
  "2.16.840.1.113883.5.1": "http://terminology.hl7.org/CodeSystem/v3-AdministrativeGender",
  "2.16.840.1.113883.1.11.19563":
    "http://terminology.hl7.org/ValueSet/v3-PersonalRelationshipRoleType",
  "2.16.840.1.113883.5.111": "http://terminology.hl7.org/CodeSystem/v3-RoleCode",
};

/**
 * Status codes are taken from the FHIR CarePlan resource
 * @see https://hl7.org/fhir/R4/valueset-care-plan-activity-status.html
 */
const validCarePlanActivityStatusCodes = [
  "not-started",
  "scheduled",
  "in-progress",
  "on-hold",
  "completed",
  "cancelled",
  "stopped",
  "unknown",
  "entered-in-error",
];

// Some helpers will be referenced in other helpers and declared outside the export below.

var evaluateTemplate = function (templatePath, inObj, returnEmptyObject = false) {
  try {
    var getNamespace = require("cls-hooked").getNamespace;
    var session = getNamespace(constants.CLS_NAMESPACE);
    var handlebarsInstance = session.get(constants.CLS_KEY_HANDLEBAR_INSTANCE);
    let templateLocation = session.get(constants.CLS_KEY_TEMPLATE_LOCATION);

    var partial = handlebarsInstance.partials[templatePath];

    if (typeof partial !== "function") {
      var content = fs.readFileSync(templateLocation + "/" + templatePath);

      // register partial with compilation output
      handlebarsInstance.registerPartial(
        templatePath,
        handlebarsInstance.compile(content.toString())
      );
      partial = handlebarsInstance.partials[templatePath];
    }
    var result = partial(inObj.hash);
    var processedResult = JSON.parse(jsonProcessor.Process(result));

    // Check if the processedResult is undefined or an empty object
    if (
      !returnEmptyObject &&
      (processedResult === undefined ||
        (Object.keys(processedResult).length === 0 && processedResult.constructor === Object))
    ) {
      return undefined;
    }

    return processedResult;
  } catch (err) {
    throw `helper "evaluateTemplate" : ${err}`;
  }
};

var concatDefinedShared = function (...args) {
  const isDefined = obj => {
    return obj !== null && obj !== undefined && !allValuesInObjAreNullFlavor(obj);
  };
  return args
    .filter(arg => isDefined(arg))
    .map(arg => JSON.stringify(arg))
    .join("");
};

/**
 * Based on the following template:
 * - Utils/GeneratePractitionerId.hbs
 *
 * @warning - If you are updating this, please also update the GeneratePractitionerId.hbs template definition.
 * Otherwise, the generated practitioner IDs will not match across different CDA sections.
 *
 * TODO ENG-640: Fix the logic. If the external ID isn't present, we should still generate a UUID from the name, addr, and telecom
 */
var generatePractitionerId = function (practitioner) {
  if (!practitioner) return undefined;

  const firstId = Array.isArray(practitioner.id) ? practitioner.id[0] : practitioner.id;

  if (firstId) {
    if (firstId.root && firstId.extension) {
      const combined = [firstId.root, "|", firstId.extension].join("");
      const id = uuidv3(combined, uuidv3.URL);
      return id;
    } else if (practitioner.assignedPerson?.name) {
      const combined = [
        JSON.stringify(practitioner.assignedPerson.name),
        JSON.stringify(practitioner.addr),
        JSON.stringify(practitioner.telecom),
      ].join("");

      const id = uuidv3(combined, uuidv3.URL);
      return id;
    }
  }

  return undefined;
};

/**
 * Based on the following template:
 * - Utils/GenerateLocationId.hbs
 *
 * @warning - If you are updating this, please also update the GenerateLocationId.hbs template definition.
 * Otherwise, the generated location IDs will not match across different CDA sections.
 */
var generateLocationId = function (location) {
  if (!location) return {};

  if (location.location?.addr) {
    const combined = concatDefinedShared(
      location.location.addr,
      location.location.name,
      location.code
    );
    const id = uuidv3(combined, uuidv3.URL);
    return id;
  } else if (location.addr) {
    const id = uuidv3(
      concatDefinedShared(location.addr, location.playingEntity?.name, location.code),
      uuidv3.URL
    );
    return id;
  } else if (location.playingEntity?.name) {
    const id = uuidv3(location.playingEntity.name, uuidv3.URL);
    return id;
  }

  return {};
};

var getSegmentListsInternal = function (msg, ...segmentIds) {
  var ret = {};
  for (var s = 0; s < segmentIds.length - 1; s++) {
    //-1 because segmentsIds includes the full message at the end
    var segOut = [];
    for (var i = 0; i < msg.meta.length; i++) {
      if (msg.meta[i] == segmentIds[s] && !!msg.data[i]) {
        segOut.push(msg.data[i]);
      }
    }
    ret[segmentIds[s]] = segOut;
  }
  return ret;
};

var normalizeSectionName = function (name) {
  return name.replace(/[^A-Za-z0-9]/g, "_");
};

// check the date is valid
var validDate = function (year, monthIndex, day) {
  var dateInstance = new Date(year, monthIndex, day);
  if (
    dateInstance.getFullYear() === Number(year) &&
    dateInstance.getMonth() === Number(monthIndex) &&
    dateInstance.getDate() === Number(day)
  )
    return true;
  return false;
};

// check the string is valid
var validDatetimeString = function (dateTimeString) {
  if (!dateTimeString || dateTimeString.toString() === "") return false;
  // datetime format in the spec: YYYY[MM[DD[HH[MM[SS[.S[S[S[S]]]]]]]]][+/-ZZZZ],
  var ds = dateTimeString.toString();
  if (!/^(\d{4}(\d{2}(\d{2}(\d{2}(\d{2}(\d{2}(\.\d+)?)?)?)?)?)?((-|\+)\d{1,4})?)$/.test(ds)) {
    return false;
  }
  return true;
};

var parseReferenceData = function (referenceData) {
  if (referenceData == undefined) {
    return "";
  }
  return JSON.stringify(referenceData).slice(1, -1).replace(/ {2,}/g, " ").trim();
};

/**
 * Based on the following template:
 * - ValueSet/SystemReference.hbs
 *
 * @warning - If you are updating this, please also update the ValueSet/SystemReference.hbs template definition.
 */
var getSystemUrl = function (codeOid, canBeUnknown = false) {
  if (!codeOid) {
    if (canBeUnknown) {
      return "http://terminology.hl7.org/ValueSet/v3-Unknown";
    }
    return undefined;
  }

  if (codeOid.startsWith("2.16.840.1.113883.3.247")) {
    return "http://terminology.hl7.org/CodeSystem-IMO.html";
  }

  const systemUrl = SYSTEM_URL_MAP[codeOid];
  if (systemUrl) {
    return systemUrl;
  }

  if (/^[0-9.]+$/.test(codeOid)) {
    return `urn:oid:${codeOid}`;
  }

  if (canBeUnknown) {
    return "http://terminology.hl7.org/ValueSet/v3-Unknown";
  }

  return `http://terminology.hl7.org/CodeSystem/${codeOid.replace(/ /g, "")}`;
};

/**
 * Based on the following template:
 * - DataType/Coding.hbs
 *
 * @warning - If you are updating this, please also update the DataType/Coding.hbs template definition.
 */
var buildCoding = function (code, canBeUnknown = false) {
  if (!code) {
    return undefined;
  }

  let display;
  if (code.displayName) {
    display = parseReferenceData(code.displayName);
  } else if (canBeUnknown) {
    display = "unknown";
  }

  return {
    code: code.code ? code.code.trim() : canBeUnknown ? "UNK" : undefined,
    display,
    version: code.codeSystemVersion,
    system: getSystemUrl(code.codeSystem, canBeUnknown),
  };
};

/**
 * Based on the following template:
 * - DataType/CodeableConcept.hbs
 *
 * @warning - If you are updating this, please also update the DataType/CodeableConcept.hbs template definition.
 */
var buildCodeableConcept = function (code, canBeUnknown = false) {
  if (!code) {
    return undefined;
  }

  let text;
  if (code.originalText?._) {
    text = parseReferenceData(code.originalText?._);
  } else if (code.text) {
    text = parseReferenceData(code.text);
  } else if (canBeUnknown) {
    text = "unknown";
  }

  const codeableConcept = {
    text,
    coding: [buildCoding(code, canBeUnknown)],
  };

  return codeableConcept;
};

var startDateLteEndDate = function (v1, v2) {
  return new Date(getDateTime(v1)).getTime() <= new Date(getDateTime(v2)).getTime();
};

/**
 * Based on the following template:
 * - DataType/Period.hbs
 *
 * @warning - If you are updating this, please also update the DataType/Period.hbs template definition.
 */
var buildPeriod = function (period) {
  const result = {};
  if (!period) {
    result.start = getDateTime(undefined);
  } else if (
    period.low &&
    period.high &&
    startDateLteEndDate(period.low.value, period.high.value)
  ) {
    result.start = getDateTime(period.low.value);
    result.end = getDateTime(period.high.value);
  } else if (
    period.low?.value &&
    period.high?.value &&
    !startDateLteEndDate(period.low.value, period.high.value)
  ) {
    result.start = getDateTime(period.low.value);
  } else if (period.low) {
    result.start = getDateTime(period.low.value);
  } else if (period.high) {
    result.end = getDateTime(period.high.value);
  } else {
    result.start = getDateTime(period.value);
  }

  return result;
};

/**
 * Returns a valid CarePlan.activity.status value from a status code.
 *
 * not-started | scheduled | in-progress | on-hold | completed | cancelled | stopped | unknown | entered-in-error
 * @param {string} statusCode - The status code to validate.
 * @returns {string} - Returns the status code if it is valid, otherwise undefined.
 */
var getCarePlanActivityStatus = function (statusCode) {
  if (!statusCode) return "unknown";
  if (validCarePlanActivityStatusCodes.includes(statusCode.trim().toLowerCase())) {
    return statusCode;
  }

  return "unknown";
};

// convert the dateString to date string with hyphens
var convertDate = function (dateString) {
  if (dateString.length === 4) return dateString;
  if (dateString.length === 6 || dateString.length >= 8) {
    var year = dateString.substring(0, 4);
    var month = dateString.substring(4, 6);
    if (month <= 0 || month > 12) throw `Invalid month: ${dateString}`;
    if (dateString.length === 6) return year + "-" + month;
    var day = dateString.substring(6, 8);
    if (!validDate(year, month - 1, day)) throw `Invalid day: ${dateString}`;
    return year + "-" + month + "-" + day;
  }
  throw `Bad input for Date type in ${dateString}`;
};

/**
 * Checks if the given dateTimeString is already in the valid format YYYY-MM-DD.
 * @param {string} dateTimeString - The date-time string to validate.
 * @returns {boolean} - Returns true if the dateTimeString is in the valid format, otherwise false.
 */
var alreadyValidDateTime = function (dateTimeString) {
  if (!dateTimeString || dateTimeString.toString() === "") return false;
  var ds = dateTimeString.toString();
  return /^(\d{4})-(\d{2})-(\d{2})(?:[T](\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,7}))?(Z|[-+]\d{2}:?\d{2})?)?$/.test(
    ds
  );
};

const incompeteIso8601Regex = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;
const iso8601RegexWithMissingT = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d{3}Z)$/;

function incompleteIso8601(dateTimeString) {
  if (isEmptyString(dateTimeString)) return false;
  if (incompeteIso8601Regex.test(dateTimeString) || iso8601RegexWithMissingT.test(dateTimeString)) {
    return true;
  }
  return false;
}

function correctIsoFormat(dateTimeString) {
  if (isEmptyString(dateTimeString)) return "";
  if (iso8601RegexWithMissingT.test(dateTimeString)) {
    const newDate = dateTimeString.trim().replace(" ", "T");
    if (alreadyValidDateTime(newDate)) return newDate;
    console.log(`Poorly reformatted the dateTime.000Z string: ${JSON.stringify(dateTimeString)}`);
  }
  if (incompeteIso8601Regex.test(dateTimeString)) {
    const newDate = dateTimeString.trim().replace(" ", "T") + ".000Z";
    if (alreadyValidDateTime(newDate)) return newDate;
    console.log(`Poorly reformatted the dateTime string: ${JSON.stringify(dateTimeString)}`);
  }
  return dateTimeString;
}

function isEmptyString(str) {
  return !str || str.trim().length < 1;
}

// handling the date format here
var getDate = function (dateStringRaw) {
  if (dateStringRaw === null || dateStringRaw === undefined) {
    return "";
  }
  if (dateStringRaw instanceof Date) {
    console.log(
      `[getDateTime] Date was a Date (converted it to string): ${JSON.stringify(dateStringRaw)}`
    );
    dateStringRaw = dateStringRaw.toISOString();
  }
  if (typeof dateStringRaw === "object") {
    if (dateStringRaw.value) {
      dateStringRaw = dateStringRaw.value.toString();
    } else {
      console.log(
        `[getDate] Date was an object (converted it to string): ${JSON.stringify(dateStringRaw)}`
      );
      dateStringRaw = dateStringRaw.toString();
    }
  }
  if (typeof dateStringRaw !== "string") {
    console.log(`[getDate] Invalid date value (returning empty): ${JSON.stringify(dateStringRaw)}`);
    return "";
  }
  var dateString = dateStringRaw?.trim();
  if (alreadyValidDateTime(dateString)) {
    return dateString;
  }
  if (!validDatetimeString(dateString)) return "";
  return convertDate(dateString.toString());
};

var getDateTimeComposition = function (ds) {
  ds = ds.replace(".", "");
  ds = ds.padEnd(17, "0");
  var year = ds.substring(0, 4);
  var month = ds.substring(4, 6);
  var day = ds.substring(6, 8);
  var hours = ds.substring(8, 10);
  var minutes = ds.substring(10, 12);
  var seconds = ds.substring(12, 14);
  var milliseconds = ds.substring(14, 17);
  var dateTimeComposition = {
    year: year,
    month: month,
    day: day,
    hours: hours,
    minutes: minutes,
    seconds: seconds,
    milliseconds: milliseconds,
  };
  return dateTimeComposition;
};

var isValidYear = function (year) {
  return parseInt(year) >= 1900;
};

// handling the datetime format here
var getDateTime = function (dateTimeStringRaw) {
  if (dateTimeStringRaw === null || dateTimeStringRaw === undefined) {
    return "";
  }
  if (dateTimeStringRaw instanceof Date) {
    console.log(
      `[getDateTime] Datetime was a Date (converted it to string): ${JSON.stringify(
        dateTimeStringRaw
      )}`
    );
    dateTimeStringRaw = dateTimeStringRaw.toISOString();
  }
  if (typeof dateTimeStringRaw === "object") {
    if (dateTimeStringRaw.value) {
      dateTimeStringRaw = dateTimeStringRaw.value.toString();
    } else {
      console.log(
        `[getDate] Date was an object (converted it to string): ${JSON.stringify(
          dateTimeStringRaw
        )}`
      );
      dateTimeStringRaw = dateTimeStringRaw.toString();
    }
  }
  if (typeof dateTimeStringRaw !== "string") {
    console.log(
      `[getDateTime] Invalid datetime value (returning empty): ${JSON.stringify(dateTimeStringRaw)}`
    );
    return "";
  }
  var dateTimeString = dateTimeStringRaw?.trim();

  if (incompleteIso8601(dateTimeString)) {
    return correctIsoFormat(dateTimeString);
  }

  if (alreadyValidDateTime(dateTimeString)) {
    return dateTimeString;
  }

  if (!validDatetimeString(dateTimeString)) {
    return "";
  }

  // handle the datetime format with time zone
  var ds = dateTimeString.toString();
  var timeZoneChar = "";
  if (ds.indexOf("-") !== -1) timeZoneChar = "-";
  else if (ds.indexOf("+") !== -1) timeZoneChar = "+";
  if (timeZoneChar !== "") {
    var dateSections = ds.split(timeZoneChar);
    var dateTimeComposition = getDateTimeComposition(dateSections[0]);

    if (!isValidYear(dateTimeComposition.year)) return "";

    var date =
      dateTimeComposition.year + "-" + dateTimeComposition.month + "-" + dateTimeComposition.day;
    var time =
      dateTimeComposition.hours +
      ":" +
      dateTimeComposition.minutes +
      ":" +
      dateTimeComposition.seconds +
      ":" +
      dateTimeComposition.milliseconds;
    var timezone = timeZoneChar + dateSections[1];

    const newDate = new Date(date + " " + time + " " + timezone);

    if (isNaN(newDate.getTime())) {
      return new Date(date).toISOString();
    }

    return newDate.toISOString();
  }

  // Padding 0s to 17 digits
  dateTimeComposition = getDateTimeComposition(ds);

  if (!isValidYear(dateTimeComposition.year)) return "";

  if (dateTimeComposition.month === "00" && dateTimeComposition.day === "00") {
    return new Date(
      Date.UTC(
        dateTimeComposition.year,
        dateTimeComposition.month,
        dateTimeComposition.day + 1,
        dateTimeComposition.hours,
        dateTimeComposition.minutes,
        dateTimeComposition.seconds,
        dateTimeComposition.milliseconds
      )
    ).toJSON();
  } else if (dateTimeComposition.day === "00") {
    return new Date(
      Date.UTC(
        dateTimeComposition.year,
        dateTimeComposition.month - 1,
        dateTimeComposition.day + 1,
        dateTimeComposition.hours,
        dateTimeComposition.minutes,
        dateTimeComposition.seconds,
        dateTimeComposition.milliseconds
      )
    ).toJSON();
  }

  return new Date(
    Date.UTC(
      dateTimeComposition.year,
      dateTimeComposition.month - 1,
      dateTimeComposition.day,
      dateTimeComposition.hours,
      dateTimeComposition.minutes,
      dateTimeComposition.seconds,
      dateTimeComposition.milliseconds
    )
  ).toJSON();
};

// Queue approach to check if all values in the json object are nullFlavor
const allValuesInObjAreNullFlavor = obj => {
  let queue = [obj];
  while (queue.length > 0) {
    let current = queue.shift();
    if (current && typeof current === "object") {
      if (Object.keys(current).length == 1 && current.nullFlavor) {
        continue;
      }
      for (let key in current) {
        if (Object.prototype.hasOwnProperty.call(current, key)) {
          if (key === "classCode") {
            continue;
          }
          queue.push(current[key]);
        }
      }
    } else if (current !== null) {
      return false;
    }
  }
  return true;
};

var getSpecifiedEntryRelationship = function (entryRelationshipContainer, targetTypeCode) {
  const entryRelationshipArray = Array.isArray(entryRelationshipContainer)
    ? entryRelationshipContainer
    : [entryRelationshipContainer];

  return entryRelationshipArray?.find(
    entryRelationship =>
      entryRelationship?.typeCode && entryRelationship.typeCode === targetTypeCode
  );
};

module.exports.internal = {
  getDateTime,
  getDate,
  convertDate,
  startDateLteEndDate,
  buildPeriod,
  generatePractitionerId,
  generateLocationId,
};

module.exports.external = [
  {
    name: "if",
    description:
      "Checks a conditional and then follows a positive or negative path based on its value: if conditional",
    func: function (conditional, options) {
      if (arguments.length != 2) {
        throw "#if requires exactly one argument";
      }

      if (HandlebarsUtils.isFunction(conditional)) {
        conditional = conditional.call(this);
      }

      // Forces all elements of the conditional to be touched.
      JSON.stringify(conditional);

      if ((!options.hash.includeZero && !conditional) || HandlebarsUtils.isEmpty(conditional)) {
        return options.inverse(this);
      } else {
        // If the direct check is not sufficient, use the queue-based approach
        if (allValuesInObjAreNullFlavor(conditional)) {
          return options.inverse(this);
        } else {
          return options.fn(this);
        }
      }
    },
  },
  {
    name: "eq",
    description: "Equals at least one of the values: eq x a b …",
    func: function (x, ...values) {
      return Array.prototype.slice.call(values.slice(0, -1)).some(a => x == a); //last element is full msg
    },
  },
  {
    name: "ne",
    description: "Not equal to any value: ne x a b …",
    func: function (x, ...values) {
      return Array.prototype.slice.call(values.slice(0, -1)).every(a => x != a); //last element is full msg
    },
  },
  {
    name: "lt",
    description: "Less than: lt a b",
    func: function (v1, v2) {
      return v1 < v2;
    },
  },
  {
    name: "gt",
    description: "Greater than: gt a b",
    func: function (v1, v2) {
      return v1 > v2;
    },
  },
  {
    name: "lte",
    description: "Less than or equal: lte a b",
    func: function (v1, v2) {
      return v1 <= v2;
    },
  },
  {
    name: "gte",
    description: "Greater than or equal: gte a b",
    func: function (v1, v2) {
      return v1 >= v2;
    },
  },
  {
    name: "not",
    description: "Not true: not x",
    func: function (val) {
      return !val;
    },
  },
  {
    name: "and",
    description: "Checks if all input arguments are true: and a b …",
    func: function (...inputElements) {
      return Array.prototype.slice.call(inputElements.slice(0, -1)).every(Boolean); //last element is full msg
    },
  },
  {
    name: "or",
    description: "Checks if at least one input argument is true: or a b …",
    func: function (...inputElements) {
      return Array.prototype.slice.call(inputElements.slice(0, -1)).some(Boolean); //last element is full msg
    },
  },
  {
    name: "elementAt",
    description: "Returns array element at position index: elementAt array index",
    func: function (arr, index) {
      return arr[index];
    },
  },
  {
    name: "charAt",
    description: "Returns char at position index: charAt string index",
    func: function (stringOrArray, index) {
      try {
        return stringOrArray.toString().charAt(index);
      } catch (err) {
        throw `helper "charAt" : ${err}`;
      }
    },
  },
  {
    name: "length",
    description: "Returns array length: length array",
    func: function (arr) {
      return arr ? arr.length : 0;
    },
  },
  {
    name: "strLength",
    description: "Returns string length: strLength string",
    func: function (str) {
      return str ? str.toString().length : 0;
    },
  },
  {
    name: "slice",
    description:
      "Returns part of an array between start and end positions (end not included): slice array start end",
    func: function (arr, start, end) {
      try {
        return arr.slice(start, end);
      } catch (err) {
        throw `helper "slice" : ${err}`;
      }
    },
  },
  {
    name: "strSlice",
    description:
      "Returns part of string between start and end positions (end not included): strSlice string start end",
    func: function (str, start, end) {
      try {
        return str.toString().slice(start, end);
      } catch (err) {
        throw `helper "strSlice" : ${err}`;
      }
    },
  },
  {
    name: "split",
    description: 'Splits the string based on regex. e.g (split "a,b,c" ","): split string regex',
    func: function (str, regexStr) {
      try {
        return str.toString().split(new RegExp(regexStr));
      } catch (err) {
        throw `helper "split" : ${err}`;
      }
    },
  },
  {
    name: "replace",
    description:
      "Replaces text in a string using a regular expression: replace string searchRegex replaceStr",
    func: function (str, searchRegex, replaceStr) {
      try {
        return str.toString().replace(new RegExp(searchRegex, "g"), replaceStr);
      } catch (err) {
        throw `helper "replace" : ${err}`;
      }
    },
  },
  {
    name: "match",
    description:
      "Returns an array containing matches with a regular expression: match string regex",
    func: function (str, regexStr) {
      try {
        return str.toString().match(new RegExp(regexStr, "g"));
      } catch (err) {
        throw `helper "match" : ${err}`;
      }
    },
  },
  {
    name: "contains",
    description:
      "Returns true if a string includes any of the provided values: contains parentStr [childStr1, childStr2, ...]",
    func: function (parentStr, ...childStrs) {
      if (!parentStr) {
        return false;
      }
      parentStr = parentStr.toString();
      return childStrs.some(childStr => parentStr.includes(childStr));
    },
  },
  {
    name: "sha1Hash",
    description: "Returns sha1 hash (in hex) of given string: sha1Hash string",
    func: function (str) {
      var shasum = crypto.createHash("sha1");
      shasum.update(str);
      return shasum.digest().toString("hex");
    },
  },
  {
    name: "base64Encode",
    description: "Returns base64 encoded string: base64Encode string encoding",
    func: function (str, encoding) {
      try {
        if (typeof encoding !== "string") {
          encoding = "utf8";
        }
        if (typeof str === "string") {
          return Buffer.from(str, encoding).toString("base64");
        }
        return Buffer.from(str?.toString(), encoding).toString("base64");
      } catch (err) {
        throw `helper "base64Encode" : ${err}`;
      }
    },
  },
  {
    name: "base64Decode",
    description: "Returns base64 decoded string: base64Decode string encoding",
    func: function (str, encoding) {
      try {
        if (typeof encoding !== "string") {
          encoding = "utf8";
        }
        return Buffer.from(str.toString(), "base64").toString(encoding);
      } catch (err) {
        throw `helper "base64Decode" : ${err}`;
      }
    },
  },
  {
    name: "gzip",
    description: "Returns compressed string: gzip string inEncoding outEncoding",
    func: function (str, inEncoding, outEncoding) {
      try {
        if (typeof inEncoding !== "string") {
          inEncoding = "utf8";
        }
        if (typeof outEncoding !== "string") {
          outEncoding = "utf8";
        }
        return zlib.gzipSync(Buffer.from(str.toString(), inEncoding)).toString(outEncoding);
      } catch (err) {
        throw `helper "gzip" : ${err}`;
      }
    },
  },
  {
    name: "gunzip",
    description: "Returns decompressed string: gunzip string inEncoding outEncoding",
    func: function (str, inEncoding, outEncoding) {
      try {
        if (typeof inEncoding !== "string") {
          inEncoding = "utf8";
        }
        if (typeof outEncoding !== "string") {
          outEncoding = "utf8";
        }
        return zlib.gunzipSync(Buffer.from(str.toString(), inEncoding)).toString(outEncoding);
      } catch (err) {
        throw `helper "gunzip" : ${err}`;
      }
    },
  },
  {
    name: "escapeSpecialChars",
    description: "Returns string with special chars escaped: escapeSpecialChars string",
    func: function (str) {
      try {
        return specialCharProcessor.Escape(str.toString());
      } catch (err) {
        return undefined;
      }
    },
  },
  {
    name: "unescapeSpecialChars",
    description:
      "Returns string after removing escaping of special char: unescapeSpecialChars string",
    func: function (str) {
      try {
        return specialCharProcessor.Unescape(str.toString());
      } catch (err) {
        throw `helper "unescapeSpecialChars" : ${err}`;
      }
    },
  },
  {
    name: "assert",
    description: "Fails with message if predicate is false: assert predicate message",
    func: function (predicate, message) {
      if (!predicate) {
        throw message;
      }
      return "";
    },
  },
  {
    name: "evaluate",
    description: "Returns template  result object: evaluate templatePath inObj",
    func: function (templatePath, inObj) {
      return evaluateTemplate(templatePath, inObj);
    },
  },
  {
    name: "optionalEvaluate",
    description:
      "Returns template result object: evaluate templatePath inObj. Will return an empty object if the result of the evaluation is undefined",
    func: function (templatePath, inObj) {
      return evaluateTemplate(templatePath, inObj, true);
    },
  },
  {
    name: "toArray",
    description: "Returns an array created (if needed) from given object: toArray obj",
    func: function (val) {
      if (Array.isArray(val)) {
        return val;
      } else {
        var arr = [];
        if (val) {
          arr.push(val);
        }
        return arr;
      }
    },
  },
  {
    name: "multipleToArray",
    func: function (...vals) {
      const uniqueSet = new Set();
      const combinedArr = [];

      // Flatten the input arrays
      const flatVals = vals.flat();

      for (let i = 0; i < flatVals.length; i++) {
        const val = flatVals[i];
        let hash;

        if (typeof val === "object" && val !== null) {
          // Attempt to create a unique hash for objects
          hash = uuidv3("".concat(JSON.stringify(val)), uuidv3.URL);
        } else {
          // Use primitive value directly
          hash = val;
        }

        if (!uniqueSet.has(hash)) {
          uniqueSet.add(hash);
          combinedArr.push(val);
        }
      }

      return combinedArr.filter(el => {
        if (!el) return true;
        return !("lookupProperty" in el);
      });
    },
  },
  {
    name: "getFirstCdaSections",
    description:
      "Returns first instance (non-alphanumeric chars replace by '_' in name) of the sections e.g. getFirstCdaSections msg 'Allergies' 'Medication': getFirstCdaSections message section1 section2 …",
    func: function getFirstCdaSections(msg, ...sectionNames) {
      try {
        var ret = {};

        for (var s = 0; s < sectionNames.length - 1; s++) {
          for (var i = 0; i < msg.ClinicalDocument.component.structuredBody.component.length; i++) {
            let sectionObj = msg.ClinicalDocument.component.structuredBody.component[i].section;

            if (sectionObj.title._.toLowerCase().includes(sectionNames[s].toLowerCase())) {
              ret[normalizeSectionName(sectionNames[s])] = sectionObj;
              break;
            }
          }
        }
        return ret;
      } catch (err) {
        throw `helper "getFirstCdaSections" : ${err}`;
      }
    },
  },
  {
    name: "getCdaSectionLists",
    description:
      "Returns instance (non-alphanumeric chars replace by '_' in name) list for the given sections e.g. getCdaSectionLists msg 'Allergies' 'Medication': getCdaSectionLists message section1 section2 …",
    func: function getCdaSectionLists(msg, ...sectionNames) {
      try {
        var ret = {};

        for (var s = 0; s < sectionNames.length - 1; s++) {
          let normalizedSectionName = normalizeSectionName(sectionNames[s]);
          ret[normalizedSectionName] = [];

          for (var i = 0; i < msg.ClinicalDocument.component.structuredBody.component.length; i++) {
            let sectionObj = msg.ClinicalDocument.component.structuredBody.component[i].section;

            if (sectionObj.title._.toLowerCase().includes(sectionNames[s].toLowerCase())) {
              ret[normalizedSectionName].push(sectionObj);
            }
          }
        }
        return ret;
      } catch (err) {
        throw `helper "getCdaSectionLists" : ${err}`;
      }
    },
  },
  {
    name: "getFirstCdaSectionsByTemplateId",
    description:
      "Returns first instance (non-alphanumeric chars replace by '_' in name) of the sections by template id e.g. getFirstCdaSectionsByTemplateId msg '2.16.840.1.113883.10.20.22.2.14' '1.3.6.1.4.1.19376.1.5.3.1.3.1': getFirstCdaSectionsByTemplateId message templateId1 templateId2 …",
    func: function getFirstCdaSectionsByTemplateId(msg, ...templateIds) {
      try {
        var ret = {};

        for (var t = 0; t < templateIds.length - 1; t++) {
          // -1 because templateIds includes the full message at the end
          if (!msg.ClinicalDocument.component?.structuredBody?.component) continue;

          let components = Array.isArray(msg.ClinicalDocument.component.structuredBody.component)
            ? msg.ClinicalDocument.component.structuredBody.component
            : [msg.ClinicalDocument.component.structuredBody.component];
          for (var i = 0; i < components.length; i++) {
            let sectionObj = components[i].section;
            let templateIdsArray = Array.isArray(sectionObj.templateId)
              ? sectionObj.templateId
              : [sectionObj.templateId];
            const hasExactMatch = templateIdsArray.some(
              templateIdObj => templateIdObj && templateIdObj.root === templateIds[t]
            );
            if (hasExactMatch) {
              ret[normalizeSectionName(templateIds[t])] = sectionObj;
              break;
            }
          }
        }
        return ret;
      } catch (err) {
        throw `helper "getFirstCdaSectionsByTemplateId" : ${err}`;
      }
    },
  },
  {
    name: "getAllCdaSectionsByTemplateId",
    description:
      "Returns all instances (non-alphanumeric chars replace by '_' in name) of the sections by template id e.g. getFirstCdaSectionsByTemplateId msg '2.16.840.1.113883.10.20.22.2.14' '1.3.6.1.4.1.19376.1.5.3.1.3.1': getFirstCdaSectionsByTemplateId message templateId1 templateId2 …",
    func: function getAllCdaSectionsByTemplateId(msg, ...templateIds) {
      try {
        var ret = [];
        if (templateIds.length <= 0) return ret;
        if (msg?.ClinicalDocument?.component?.structuredBody?.component === undefined) return ret;

        // -1 because templateIds includes the full message at the end
        for (var t = 0; t < templateIds.length - 1; t++) {
          for (var i = 0; i < msg.ClinicalDocument.component.structuredBody.component.length; i++) {
            const sectionObj = msg.ClinicalDocument.component.structuredBody.component[i].section;
            if (
              sectionObj?.templateId &&
              JSON.stringify(sectionObj.templateId).includes(templateIds[t])
            ) {
              var item = {};
              item[normalizeSectionName(templateIds[t])] = sectionObj;
              ret.push(item);
            }
          }
        }
        return ret;
      } catch (err) {
        throw `helper "getAllCdaSectionsByTemplateId" : ${err}`;
      }
    },
  },
  {
    name: "getAllCdaSectionsWithoutTemplateId",
    description: "Returns an array of section contents based on the provided section templateIds",
    func: function getAllCdaSectionsByTemplateId(msg, ...templateIds) {
      try {
        var ret = [];
        if (templateIds.length <= 0) return ret;
        if (msg?.ClinicalDocument?.component?.structuredBody?.component === undefined) return ret;

        // -1 because templateIds includes the full message at the end
        for (var t = 0; t < templateIds.length - 1; t++) {
          for (var i = 0; i < msg.ClinicalDocument.component.structuredBody.component.length; i++) {
            const sectionObj = msg.ClinicalDocument.component.structuredBody.component[i].section;
            if (
              sectionObj?.templateId &&
              JSON.stringify(sectionObj.templateId).includes(templateIds[t])
            ) {
              ret.push(sectionObj);
            }
          }
        }
        return ret;
      } catch (err) {
        throw `helper "getAllCdaSectionsWithoutTemplateId" : ${err}`;
      }
    },
  },
  {
    name: "getFieldRepeats",
    description: "Returns repeat list for a field: getFieldRepeats fieldData",
    func: function getFieldRepeats(fieldData) {
      try {
        if (fieldData) {
          // Mark all sub fields accessed.
          fieldData.forEach(() => {});
          return fieldData.repeats;
        }
        return fieldData;
      } catch (err) {
        throw `helper "getFieldRepeats" : ${err}`;
      }
    },
  },
  {
    name: "getFirstSegments",
    description:
      "Returns first instance of the segments e.g. getFirstSegments msg.v2 'PID' 'PD1': getFirstSegments message segment1 segment2 …",
    func: function getFirstSegments(msg, ...segmentIds) {
      try {
        var ret = {};
        var inSegments = {};
        for (var s = 0; s < segmentIds.length - 1; s++) {
          //-1 because segmentsIds includes the full message at the end
          inSegments[segmentIds[s]] = true;
        }
        for (var i = 0; i < msg.meta.length; i++) {
          if (inSegments[msg.meta[i]] && !ret[msg.meta[i]]) {
            ret[msg.meta[i]] = msg.data[i];
          }
        }
        return ret;
      } catch (err) {
        throw `helper "getFirstSegments" : ${err}`;
      }
    },
  },
  {
    name: "getSegmentLists",
    description: "Extract HL7 v2 segments: getSegmentLists message segment1 segment2 …",
    func: function getSegmentLists(msg, ...segmentIds) {
      try {
        return getSegmentListsInternal(msg, ...segmentIds);
      } catch (err) {
        throw `helper "getSegmentLists" : ${err}`;
      }
    },
  },
  {
    name: "getRelatedSegmentList",
    description:
      "Given a segment name and index, return the collection of related named segments: getRelatedSegmentList message parentSegmentName parentSegmentIndex childSegmentName",
    func: function getRelatedSegmentList(msg, parentSegment, parentIndex, childSegment) {
      try {
        var ret = {};
        var segOut = [];
        var parentFound = false;
        var childIndex = -1;

        for (var i = 0; i < msg.meta.length; i++) {
          if (msg.meta[i] == parentSegment && msg.data[i][0] == parentIndex) {
            parentFound = true;
          } else if (msg.meta[i] == childSegment && parentFound == true) {
            childIndex = i;
            break;
          }
        }

        if (childIndex > -1) {
          do {
            if (msg.data[childIndex]) {
              segOut.push(msg.data[childIndex]);
            }
            childIndex++;
          } while (childIndex < msg.meta.length && msg.meta[childIndex] == childSegment);
        }

        ret[childSegment] = segOut;
        return ret;
      } catch (err) {
        throw `helper "getRelatedSegmentList" : ${err}`;
      }
    },
  },
  {
    name: "getParentSegment",
    description:
      "Given a child segment name and overall message index, return the first matched parent segment: getParentSegment message childSegmentName childSegmentIndex parentSegmentName",
    func: function getParentSegment(msg, childSegment, childIndex, parentSegment) {
      try {
        var ret = {};
        var msgIndex = -1;
        var parentIndex = -1;
        var foundChildSegmentCount = -1;

        for (var i = 0; i < msg.meta.length; i++) {
          if (msg.meta[i] == childSegment) {
            // count how many segments of the child type that we have found
            // as the passed in child index is relative to the entire message
            foundChildSegmentCount++;
            if (foundChildSegmentCount == childIndex) {
              msgIndex = i;
              break;
            }
          }
        }

        // search backwards from the found child for the first instance
        // of the parent segment type
        for (i = msgIndex; i > -1; i--) {
          if (msg.meta[i] == parentSegment) {
            parentIndex = i;
            break;
          }
        }

        if (parentIndex > -1) {
          ret[parentSegment] = msg.data[parentIndex];
        }

        return ret;
      } catch (err) {
        throw `helper "getParentSegment" : ${err}`;
      }
    },
  },
  {
    name: "hasSegments",
    description: "Check if HL7 v2 message has segments: hasSegments message segment1 segment2 …",
    func: function (msg, ...segmentIds) {
      try {
        var exSeg = getSegmentListsInternal(msg, ...segmentIds);
        for (var s = 0; s < segmentIds.length - 1; s++) {
          //-1 because segmentsIds includes the full message at the end
          if (!exSeg[segmentIds[s]] || exSeg[segmentIds[s]].length == 0) {
            return false;
          }
        }
        return true;
      } catch (err) {
        throw `helper "hasSegments" : ${err}`;
      }
    },
  },
  {
    name: "concat",
    description: "Returns the concatenation of provided strings: concat aString bString cString …",
    func: function (...values) {
      if (Array.isArray(values[0])) {
        return [].concat(...values.slice(0, -1)); //last element is full msg
      }
      return "".concat(...values.slice(0, -1)); //last element is full msg
    },
  },
  {
    name: "generateUUID",
    description: "Generates a guid based on a URL: generateUUID url",
    func: function (urlNamespace) {
      return uuidv3("".concat(urlNamespace), uuidv3.URL);
    },
  },
  {
    name: "generateUUIDV2",
    description:
      "Generates a guid based on a URL: generateUUID url, Keep the results consistent across platforms, regardless of the platform's newline characters",
    func: function (urlNamespace) {
      if (urlNamespace === undefined || urlNamespace === null) {
        throw Error(`Invalid argument: ${urlNamespace}`);
      }
      const content = "".concat(urlNamespace).replace(/(\r|\n|\r\n|\\r|\\n|\\r\\n)/gm, "");
      return uuidv3(content, uuidv3.URL);
    },
  },
  {
    name: "addHyphensSSN",
    description: "Adds hyphens to a SSN without hyphens: addHyphensSSN SSN",
    func: function (ssn) {
      try {
        ssn = ssn.toString();

        // Should be 9 digits
        if (!/^\d{9}$/.test(ssn)) {
          return ssn;
        }

        return ssn.substring(0, 3) + "-" + ssn.substring(3, 5) + "-" + ssn.substring(5, 9);
      } catch (err) {
        return "";
      }
    },
  },
  {
    name: "addHyphensDate",
    description: "Adds hyphens to a date without hyphens: addHyphensDate date",
    func: function (date) {
      try {
        return getDate(date);
      } catch (err) {
        throw `helper "addHyphensDate" : ${err}`;
      }
    },
  },
  {
    name: "now",
    description: "Provides current UTC time in YYYYMMDDHHmmss.SSS format: now",
    func: function () {
      var datetimeString = new Date().toISOString().replace(/[^0-9]/g, "");
      return datetimeString.slice(0, 14) + "." + datetimeString.slice(14, 17);
    },
  },
  {
    name: "formatAsDateTime",
    description:
      "Converts an  YYYY[MM[DD[HH[MM[SS[.S[S[S[S]]]]]]]]][+/-ZZZZ] string, e.g. 20040629175400.000 to dateTime format, e.g. 2004-06-29T17:54:00.000z: formatAsDateTime(dateTimeString)",
    func: function (dateTimeString) {
      try {
        return getDateTime(dateTimeString);
      } catch (err) {
        console.log(`helper "formatAsDateTime" : ${err}`);
      }
    },
  },
  {
    name: "getFirstEffectiveTimeFromObservationComponent",
    description: "Getting the first effective time from observation components",
    func: function (components) {
      if (!Array.isArray(components)) return undefined;
      const component = components.find(comp => comp?.observation?.effectiveTime?.value);
      return component?.observation?.effectiveTime?.value;
    },
  },
  {
    name: "toString",
    description: "Converts to string: toString object",
    func: function (str) {
      return str.toString();
    },
  },
  {
    name: "toJsonString",
    description: "Converts to JSON string: toJsonString object",
    func: function (str) {
      return JSON.stringify(str);
    },
  },
  {
    name: "toJsonStringPrettier",
    description: "Converts to JSON string with prettier logging: toJsonStringPrettier object",
    func: function (str) {
      return JSON.stringify(str, null, 2);
    },
  },
  {
    name: "toLower",
    description: "Converts string to lower case: toLower string",
    func: function (str) {
      try {
        return str.toString().toLowerCase();
      } catch (err) {
        return "";
      }
    },
  },
  {
    name: "trim",
    description: "Trims string: trim string",
    func: function (str) {
      try {
        return str.toString().trim();
      } catch (err) {
        return "";
      }
    },
  },
  {
    name: "trimAndLower",
    description: "Trims and converts string to lower case: trimAndLower string",
    func: function (str) {
      try {
        return str.toString().trim().toLowerCase();
      } catch (err) {
        return "";
      }
    },
  },
  {
    name: "trimAndUpper",
    description: "Trims and converts string to upper case: trimAndUpper string",
    func: function (str) {
      try {
        return str.toString().trim().toUpperCase();
      } catch (err) {
        return "";
      }
    },
  },
  {
    name: "toUpper",
    description: "Converts string to upper case: toUpper string",
    func: function (str) {
      try {
        return str.toString().toUpperCase();
      } catch (err) {
        return "";
      }
    },
  },
  {
    name: "isNaN",
    description: "Checks if the object is not a number using JavaScript isNaN: isNaN object",
    func: function (o) {
      return isNaN(o);
    },
  },
  {
    name: "abs",
    description: "Returns the absolute value of a number: abs number",
    func: function (x) {
      return Math.abs(x);
    },
  },
  {
    name: "ceil",
    description: "Returns the next largest whole number or integer: ceil number",
    func: function (x) {
      return Math.ceil(x);
    },
  },
  {
    name: "floor",
    description: "Returns the largest integer less than or equal to a given number: floor number",
    func: function (x) {
      return Math.floor(x);
    },
  },
  {
    name: "max",
    description: "Returns the largest of zero or more numbers: max number1, number2, number3 . . .",
    func: function () {
      var args = [];
      for (var i = 0; i < arguments.length - 1; i++) args[i] = arguments[i];
      return Math.max(...args);
    },
  },
  {
    name: "min",
    description:
      "Returns the lowest-valued number passed into it, or NaN if any parameter isn't a number and can't be converted into one: min number1, number2, number3 . . .",
    func: function () {
      var args = [];
      for (var i = 0; i < arguments.length - 1; i++) args[i] = arguments[i];
      return Math.min(...args);
    },
  },
  {
    name: "pow",
    description:
      "Returns the base to the exponent power, that is, base^exponent.: pow base, exponent",
    func: function (x, y) {
      return Math.pow(x, y);
    },
  },
  {
    name: "random",
    description:
      "Returns a floating-point, pseudo-random number in the range 0 to less than 1 (inclusive of 0, but not 1) with approximately uniform distribution over that range — which you can then scale to your desired range: random",
    func: function () {
      return Math.random();
    },
  },
  {
    name: "round",
    description: "Returns the value of a number rounded to the nearest integer: round number",
    func: function (x) {
      return Math.round(x);
    },
  },
  {
    name: "sign",
    description:
      "returns either a positive or negative +/- 1, indicating the sign of a number passed into the argument. If the number passed into is 0, it will return a +/- 0. Note that if the number is positive, an explicit (+) will not be returned: sign number",
    func: function (x) {
      return Math.sign(x);
    },
  },
  {
    name: "trunc",
    description:
      "Returns the integer part of a number by removing any fractional digits: trunc number",
    func: function (x) {
      return Math.trunc(x);
    },
  },
  {
    name: "add",
    description: "add two numbers: + number1 number 2",
    func: function (x, y) {
      return Number(x) + Number(y);
    },
  },
  {
    name: "subtract",
    description: "subtract second number from the first: - number1 number2",
    func: function (x, y) {
      return Number(x) - Number(y);
    },
  },
  {
    name: "multiply",
    description: "multiply two numbers: * number1 number2",
    func: function (x, y) {
      return Number(x) * Number(y);
    },
  },
  {
    name: "divide",
    description: "divide first number by the second number: / number1 number2",
    func: function (x, y) {
      return Number(x) / Number(y);
    },
  },
  {
    name: "startsWith",
    description: "Checks if a string starts with a given substring: startsWith string substring",
    func: function (str, substr) {
      return str.startsWith(substr);
    },
  },
  {
    name: "parseReferenceData",
    description:
      "Escapes new line and other special chars when parsing ._ fields and then strips JSON of quotes at start and end",
    func: function (referenceData) {
      return parseReferenceData(referenceData);
    },
  },
  {
    name: "personalRelationshipRoleTypeCodeSystem",
    description: "Returns the code system for the related person relationship code",
    func: function () {
      return PERSONAL_RELATIONSHIP_TYPE_CODE;
    },
  },
  {
    name: "decodeHtmlEntities",
    description: "Decodes html strings",
    func: function (str) {
      if (!str) {
        return "";
      }
      const result = he.decode(str);
      return result;
    },
  },
  {
    name: "convertFeetAndInchesToCm",
    description:
      "Checks if a string is in the format 'number ft number in' and if so, converts the feet and inches to centimeters",
    func: function (str) {
      if (!str) {
        return { isValid: false };
      }
      const match = str.match(
        new RegExp(`^(${DECIMAL_REGEX_STR}) ft (${DECIMAL_REGEX_STR})( in)?$`)
      );
      if (match) {
        const inches = 12 * parseFloat(match[1]) + parseFloat(match[2]);
        const cm = convert(inches).from("in").to("cm");
        const cmRounded = parseFloat(cm.toFixed(2));
        return { isValid: true, value: cmRounded, unit: "cm" };
      } else {
        return { isValid: false };
      }
    },
  },
  {
    name: "extractNumberAndUnit",
    description:
      "Checks if a string is in the format 'number unit' and if so, extracts the number and the unit",
    func: function (str) {
      if (!str) {
        return { isValid: false };
      }
      const match = str.match(/^(\d+(?:\.\d+)?)(\s*)([a-zA-Z/()[\]]+)$/);
      if (match) {
        return { isValid: true, value: parseFloat(match[1]), unit: match[3] };
      } else {
        return { isValid: false };
      }
    },
  },
  {
    name: "extractComparator",
    description:
      "Checks if a string starts with a comparator followed by a decimal number, and if so, extracts the comparator and the number",
    func: function (str) {
      if (!str) {
        return { isValid: false };
      }
      const match = str.match(new RegExp(`^([<>]=?)(${DECIMAL_REGEX_STR})$`));
      if (match) {
        return { isValid: true, comparator: match[1], number: parseFloat(match[2]) };
      } else {
        return { isValid: false };
      }
    },
  },
  {
    name: "extractRangeFromQuantity",
    description:
      "Checks if a value field of a FHIR Quantity object is in the format 'alphanumeric-alphanumeric' and if so, extracts the two alphanumeric values",
    func: function (obj) {
      if (obj === undefined || obj === null || obj.value === undefined) {
        return { isValid: false };
      }
      const match = obj.value.match(
        new RegExp(`^\\s*(${DECIMAL_REGEX_STR})\\s*-\\s*(${DECIMAL_REGEX_STR})\\s*$`)
      );
      if (match) {
        return {
          isValid: true,
          range: {
            low: {
              value: match[1],
              unit: obj.unit || "",
            },
            high: {
              value: match[2],
              unit: obj.unit || "",
            },
          },
        };
      } else {
        return { isValid: false };
      }
    },
  },
  {
    name: "extractReferenceRange",
    description: "Parses lab result reference value ranges",
    func: function (obj) {
      function cleanUpReturn(obj1, obj2, name1, name2) {
        if (!obj1 && !obj2) return;
        return {
          ...(obj1 && { [name1]: obj1 }),
          ...(obj2 && { [name2]: obj2 }),
        };
      }

      function getRangeLimit(limit) {
        if (!limit) return;
        if (limit.value) {
          return limit;
        } else if (limit.nullFlavor === "OTH") {
          const translation = limit.translation;
          const value = translation?.value ?? undefined;
          const unit = translation?.originalText?._ ?? undefined;
          return cleanUpReturn(value, unit, "value", "unit");
        }
        return;
      }

      function buildRange(value) {
        if (!value) return;
        if (value.includes("-")) {
          const [low, high] = value.split("-");
          return {
            low: {
              value: low.trim(),
            },
            high: {
              value: high.trim(),
            },
          };
        }
        if (typeof value === "string") {
          return {
            low: {
              value: value.trim(),
            },
          };
        }
      }

      function parseRange(range) {
        const value = range.value;
        if (value) {
          if (value["x:type"] === "ST") {
            if (value._) {
              return buildRange(value._);
            }
          } else if (value["x:type"] === "IVL_PQ" || value["x:type"] === "IVL_REAL") {
            const low = getRangeLimit(value.low);
            const high = getRangeLimit(value.high);
            const ret = cleanUpReturn(low, high, "low", "high");
            if (ret) return ret;
          }
        } else if (range.low || range.high) {
          const low = getRangeLimit(range.low);
          const high = getRangeLimit(range.high);
          const ret = cleanUpReturn(low, high, "low", "high");
          if (ret) return ret;
        }
        if (range.text?._) {
          return buildRange(range.text._);
        }
      }

      return parseRange(obj);
    },
  },
  {
    name: "buildPresentedForm",
    description: "Builds a presented form array",
    func: function (b64String, component) {
      const presentedForm = [];
      if (b64String) {
        presentedForm.push({
          contentType: "text/html",
          data: b64String,
        });
      }
      if (component) {
        const components = Array.isArray(component) ? component : [component];
        components.forEach(comp => {
          const obsValueB64 = comp.observation?.value?._b64;
          if (obsValueB64) {
            presentedForm.push({
              contentType: "text/html",
              data: obsValueB64,
            });
          }
        });
      }
      if (presentedForm.length === 0) return undefined;
      return JSON.stringify(presentedForm);
    },
  },
  {
    name: "extractDecimal",
    description:
      "Returns true if following the FHIR decimal specification: https://www.hl7.org/fhir/R4/datatypes.html#decimal ",
    func: function (str) {
      if (!str) {
        return undefined;
      }
      const match = str.match(new RegExp(`^(${DECIMAL_REGEX_STR})$`));

      if (match) {
        const decimal = match[0];
        const leadsWithDecimal = decimal.startsWith(".");

        if (leadsWithDecimal) {
          return parseFloat(`0${decimal}`);
        }

        return parseFloat(decimal);
      }

      return undefined;
    },
  },
  {
    name: "generatePractitionerId",
    description: "Generates a practitioner UUID from a performer object",
    func: function (practitioner) {
      return generatePractitionerId(practitioner);
    },
  },
  {
    name: "generateLocationId",
    description: "Generates a location UUID from a participantRole object",
    func: function (location) {
      return generateLocationId(location);
    },
  },
  {
    name: "getActivityFromTreatmentPlanEncounter",
    description: "Builds the activity field for the CarePlan resource",
    func: function (encounter) {
      if (!encounter) return undefined;

      const activity = [];

      const status = getCarePlanActivityStatus(
        encounter.entryRelationship?.act?.statusCode?.code ?? encounter.statusCode?.code
      );

      const detail = { status };
      const performer = encounter.performer?.assignedEntity;
      if (performer) {
        const performerId = generatePractitionerId(performer);
        detail.performer = [
          {
            reference: `Practitioner/${performerId}`,
          },
        ];
      }

      const participantRole = encounter.participant?.participantRole;
      if (participantRole) {
        const participantRoleId = generateLocationId(participantRole);
        detail.location = {
          reference: `Location/${participantRoleId}`,
        };
      }

      const scheduledPeriod = buildPeriod(encounter.effectiveTime);
      if (scheduledPeriod) {
        detail.scheduledPeriod = scheduledPeriod;
      }

      if (encounter.entryRelationship?.act) {
        const code = buildCodeableConcept(encounter.entryRelationship.act.code);
        if (code) {
          detail.code = code;
        }

        const activityDescription = encounter.entryRelationship.act.text?._;
        if (activityDescription) {
          detail.description = activityDescription;
        }
      }

      activity.push({ detail });

      return JSON.stringify(activity);
    },
  },
  {
    name: "extractAndMapTableData",
    description:
      "Extracts and maps table data from a JSON structure to an array of objects based on table headers and rows.",
    func: function (json) {
      if (!json || !json.table || !json.table.thead || !json.table.tbody) {
        return undefined;
      }

      const getHeaders = thead => {
        if (!thead.tr || !thead.tr.th) return [];
        return Array.isArray(thead.tr.th) ? thead.tr.th.map(th => th._) : [thead.tr.th._];
      };

      // we are handling two scenarios rn. One where the values are stored in the pagraph tag and the other where the values are stored in the td tag
      const getRowData = (tr, headers) => {
        if (!tr || !tr.td || headers.length === 0) return undefined;
        const tdArray = Array.isArray(tr.td) ? tr.td : [tr.td];
        const rowData = {};
        tdArray.forEach((td, index) => {
          if (!td) return;
          if (td.paragraph) {
            const paragraphArray = Array.isArray(td.paragraph) ? td.paragraph : [td.paragraph];
            const textValues = paragraphArray
              .map(paragraph => {
                if (!paragraph || !paragraph.content) return "";
                const contentArray = Array.isArray(paragraph.content)
                  ? paragraph.content
                  : [paragraph.content];
                return concatenateTextValues(contentArray);
              })
              .join("\n");
            rowData[headers[index]] = textValues;
          } else {
            rowData[headers[index]] = td._ || "";
          }
        });
        return rowData;
      };

      const concatenateTextValues = content => {
        if (!content) return "";
        const contentArray = Array.isArray(content) ? content : [content];
        return contentArray
          .filter(item => item && "_ in item")
          .map(item => item._)
          .join("\n");
      };

      const headers = getHeaders(json.table.thead);
      if (headers.length === 0) return undefined;

      const trArray = Array.isArray(json.table.tbody.tr)
        ? json.table.tbody.tr
        : [json.table.tbody.tr];
      if (trArray.length === 0) return undefined;

      const mappedData = trArray.map(tr => getRowData(tr, headers));
      if (mappedData === "") return undefined;

      return mappedData;
    },
  },
  {
    name: "extractTextFromNestedProperties",
    description: "extracts text from various nested properties",
    func: function (data) {
      let texts = [];

      function recursiveSearch(obj) {
        if (typeof obj === "object" && obj !== null) {
          if ("_" in obj) {
            texts.push(obj["_"]);
          }
          for (let key in obj) {
            recursiveSearch(obj[key]);
          }
        } else if (Array.isArray(obj)) {
          obj.forEach(element => recursiveSearch(element));
        }
      }

      recursiveSearch(data);
      return texts.join("\n");
    },
  },
  {
    name: "convertMappedDataToPlainText",
    description: "Converts mapped data to plain text format.",
    func: function (mappedData) {
      if (!mappedData || mappedData.length === 0) return "";
      return mappedData
        .map(entry => {
          return Object.entries(entry)
            .map(([key, value]) => `${key}: ${value}`)
            .join("\n");
        })
        .join("\n\n");
    },
  },
  {
    name: "buildDefaultDiagReportDetails",
    description: "Returns default diagnostic reports details based on the CDA section",
    func: function (section) {
      const defaultCode = {
        code: "34109-9",
        codeSystem: "2.16.840.1.113883.6.1",
        codeSystemName: "LOINC",
        displayName: "Note",
      };
      return {
        statusCode: { code: "completed" },
        code: section.code ?? defaultCode,
        templateId: { root: "2.16.840.1.113883.10.20.22.4.202", extension: "2016-11-01" },
      };
    },
  },
  {
    name: "coalesce",
    description: "Returns the first non-null/undefined value from the list of provided arguments.",
    func: function (...args) {
      // Last argument is Handlebars options object, so we exclude it
      const values = args.slice(0, -1);
      for (let value of values) {
        if (value !== undefined) {
          return value;
        }
      }
      return undefined;
    },
  },
  {
    name: "concatDefined",
    description: "Concatenates defined objects, checking for null, undefined, or UNK nullFlavor.",
    func: function (...args) {
      args.pop();

      const isDefined = obj => {
        return obj !== null && obj !== undefined && !allValuesInObjAreNullFlavor(obj);
      };
      return args
        .filter(arg => isDefined(arg))
        .map(arg => JSON.stringify(arg))
        .join("");
    },
  },
  {
    name: "concatDefinedV2",
    description: "Concatenates defined objects, checking for null, undefined, or UNK nullFlavor.",
    func: function (...args) {
      return concatDefinedShared(...args);
    },
  },
  {
    name: "nullFlavorAwareOr",
    description: "OR logic that checks for nullFlavor in objects.",
    func: function (...args) {
      const values = args.slice(0, -1);
      for (let arg of values) {
        if (
          (arg && typeof arg !== "object") ||
          (typeof arg === "object" && !allValuesInObjAreNullFlavor(arg))
        ) {
          return true;
        }
      }
      return false;
    },
  },
  {
    name: "startDateLteEndDate",
    description: "Checks if the start date is less than or equal to the end date.",
    func: function (v1, v2) {
      return startDateLteEndDate(v1, v2);
    },
  },
  {
    name: "getSpecifiedEntryRelationship",
    description: "Returns the specified entry relationship if it exists.",
    func: function (entryRelationships, targetTypeCode) {
      return getSpecifiedEntryRelationship(entryRelationships, targetTypeCode);
    },
  },
];
