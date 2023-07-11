// -------------------------------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License (MIT). See LICENSE in the repo root for license information.
// -------------------------------------------------------------------------------------------------

// design the test cases
var ruleSets = require("./rule-sets");

const patterns = [
  { template: "ADT_A01.hbs", data: ["ADT01-23.hl7", "ADT01-28.hl7"] },
  { template: "VXU_V04.hbs", data: ["VXU.hl7", "IZ_1_1.1_Admin_Child_Max_Message.hl7"] },
  {
    template: "ORU_R01.hbs",
    data: [
      "LAB-ORU-1.hl7",
      "LAB-ORU-2.hl7",
      "LRI_2.0-NG_CBC_Typ_Message.hl7",
      "ORU-R01-RMGEAD.hl7",
    ],
  },
  { template: "OML_O21.hbs", data: ["MDHHS-OML-O21-1.hl7", "MDHHS-OML-O21-2.hl7"] },
];

module.exports = () => {
  const cases = [];
  patterns.forEach(pattern => {
    for (const dataFile of pattern.data) {
      cases.push({ templateFile: pattern.template, dataFile, testRules: ruleSets.commonRules });
    }
  });
  return cases;
};
