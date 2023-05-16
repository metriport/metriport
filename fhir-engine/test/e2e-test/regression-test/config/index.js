// -------------------------------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License (MIT). See LICENSE in the repo root for license information.
// -------------------------------------------------------------------------------------------------

const cdaCases = require("./testcases-cda")();
const hl7v2Cases = require("./testcases-hl7v2")();

module.exports = { cdaCases, hl7v2Cases };
