// -------------------------------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License (MIT). See LICENSE in the repo root for license information.
// -------------------------------------------------------------------------------------------------
var hl7v2 = require("../hl7v2/hl7v2");
var cda = require("../cda/cda");

module.exports = class dataHandlerFactory {
  static createDataHandler(dataType) {
    if (dataType === "cda") return new cda();
    if (dataType === "hl7v2") return new hl7v2();
  }
}