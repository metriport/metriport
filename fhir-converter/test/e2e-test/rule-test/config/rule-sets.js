// -------------------------------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License (MIT). See LICENSE in the repo root for license information.
// -------------------------------------------------------------------------------------------------

// define your own rule set as you want
var rules = require("../util/test-rule-functions");
var commonRules = [rules.onePatient, rules.noDefaultGuid, rules.noSameGuid];
var guidRules = [rules.noDefaultGuid, rules.noSameGuid];

module.exports = {
  commonRules: commonRules,
  guidRules: guidRules,
};
