// -------------------------------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License (MIT). See LICENSE in the repo root for license information.
// -------------------------------------------------------------------------------------------------
var hl7v2 = require("../hl7v2/hl7v2");
var cda = require("../cda/cda");

var map = [];
map["cda"] = new cda();
map["hl7v2"] = new hl7v2();

module.exports = class dataHandlerFactory {
  static createDataHandler(dataType) {
    return map[dataType];
  }
};
