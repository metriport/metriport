const typeIvlPq = {
  text: {
    _: "12.0 - 15.5",
  },
  value: {
    "x:type": "IVL_PQ",
    "xmlns:x": "http://www.w3.org/2001/XMLSchema-instance",
    low: {
      value: "12.0",
      unit: "g/dL",
    },
    high: {
      value: "15.5",
      unit: "g/dL",
    },
  },
  interpretationCode: {
    code: "N",
    codeSystem: "2.16.840.1.113883.5.83",
  },
};

const typeIvlPqOutput = {
  low: { value: "12.0", unit: "g/dL" },
  high: { value: "15.5", unit: "g/dL" },
};

const nullFlavorOth = {
  text: {
    _: "3.90 - 5.40 M/uL",
  },
  value: {
    "x:type": "IVL_PQ",
    "xmlns:x": "http://www.w3.org/2001/XMLSchema-instance",
    low: {
      nullFlavor: "OTH",
      translation: {
        nullFlavor: "OTH",
        value: "3.90",
        originalText: {
          _: "M/uL",
        },
      },
    },
    high: {
      nullFlavor: "OTH",
      translation: {
        nullFlavor: "OTH",
        value: "5.40",
        originalText: {
          _: "M/uL",
        },
      },
    },
  },
  interpretationCode: {
    code: "N",
    codeSystem: "2.16.840.1.113883.5.83",
  },
};

const nullFlavorOthOutput = {
  low: { value: "3.90", unit: "M/uL" },
  high: { value: "5.40", unit: "M/uL" },
};

const lessThan = {
  text: {
    _: "<16.4",
  },
  value: {
    "x:type": "IVL_PQ",
    "xmlns:x": "http://www.w3.org/2001/XMLSchema-instance",
    low: {
      nullFlavor: "NINF",
      unit: "%",
      inclusive: "false",
    },
    high: {
      value: "16.4",
      unit: "%",
      inclusive: "false",
    },
  },
  interpretationCode: {
    code: "N",
    codeSystem: "2.16.840.1.113883.5.83",
  },
};

const lessThanOutput = { high: { value: "16.4", unit: "%", inclusive: "false" } };

const valueInTranslation = {
  text: {
    _: "0.34 - 4.82 uIU/mL",
  },
  value: {
    "x:type": "IVL_PQ",
    "xmlns:x": "http://www.w3.org/2001/XMLSchema-instance",
    low: {
      nullFlavor: "OTH",
      translation: {
        nullFlavor: "OTH",
        value: "0.34",
        originalText: {
          _: "uIU/mL",
        },
      },
    },
    high: {
      nullFlavor: "OTH",
      translation: {
        nullFlavor: "OTH",
        value: "4.82",
        originalText: {
          _: "uIU/mL",
        },
      },
    },
  },
  interpretationCode: {
    code: "N",
    codeSystem: "2.16.840.1.113883.5.83",
  },
};

const valueInTranslationOutput = {
  low: { value: "0.34", unit: "uIU/mL" },
  high: { value: "4.82", unit: "uIU/mL" },
};

const typeStNonNumeric = {
  text: {
    _: "Neg",
  },
  value: {
    _: "Neg",
    "x:type": "ST",
    "xmlns:x": "http://www.w3.org/2001/XMLSchema-instance",
  },
  interpretationCode: {
    code: "N",
    codeSystem: "2.16.840.1.113883.5.83",
  },
};

const typeStNonNumericOutput = { low: { value: "Neg" } };

const typeIvlReal = {
  text: { _: "1.005 - 1.030" },
  value: {
    "x:type": "IVL_REAL",
    "xmlns:x": "http://www.w3.org/2001/XMLSchema-instance",
    low: { value: "1.005" },
    high: { value: "1.030" },
  },
  interpretationCode: { code: "N", codeSystem: "2.16.840.1.113883.5.83" },
};

const typeIvlRealOutput = { low: { value: "1.005" }, high: { value: "1.030" } };

const typeStMixed = {
  text: { _: "None - 9" },
  value: {
    _: "None - 9",
    "x:type": "ST",
    "xmlns:x": "http://www.w3.org/2001/XMLSchema-instance",
  },
  interpretationCode: { code: "N", codeSystem: "2.16.840.1.113883.5.83" },
};

const typeStMixedOutput = { low: { value: "None" }, high: { value: "9" } };

module.exports = {
  typeIvlPq,
  typeIvlPqOutput,
  nullFlavorOth,
  nullFlavorOthOutput,
  lessThan,
  lessThanOutput,
  valueInTranslation,
  valueInTranslationOutput,
  typeStNonNumeric,
  typeStNonNumericOutput,
  typeIvlReal,
  typeIvlRealOutput,
  typeStMixed,
  typeStMixedOutput,
};
