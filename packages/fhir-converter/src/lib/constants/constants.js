// -------------------------------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License (MIT). See LICENSE in the repo root for license information.
// -------------------------------------------------------------------------------------------------

var path = require("path");

let serviceTemplateFolder = "../../service-templates";
let sampleDataFolder = "../../sample-data";

module.exports.BASE_TEMPLATE_FILES_LOCATION = path.join(__dirname, "../../templates");
module.exports.TEMPLATE_FILES_LOCATION = path.join(__dirname, serviceTemplateFolder);
module.exports.SAMPLE_DATA_LOCATION = path.join(__dirname, sampleDataFolder);
module.exports.STATIC_LOCATION = path.join(__dirname, "../../static");
module.exports.CODE_MIRROR_LOCATION = path.join(__dirname, "../../../node_modules/codemirror/");
module.exports.MOVE_TO_GLOBAL_KEY_NAME = "_moveResourceToGlobalScope";
module.exports.HL7V2_TEMPLATE_LOCATION = path.join(__dirname, serviceTemplateFolder, "hl7v2");
module.exports.HL7V2_DATA_LOCATION = path.join(__dirname, sampleDataFolder, "hl7v2");
module.exports.CDA_TEMPLATE_LOCATION = path.join(__dirname, serviceTemplateFolder, "cda");
module.exports.CDA_DATA_LOCATION = path.join(__dirname, sampleDataFolder, "cda");
module.exports.CLS_NAMESPACE = "conversionRequest";
module.exports.CLS_KEY_HANDLEBAR_INSTANCE = "hbs";
module.exports.CLS_KEY_TEMPLATE_LOCATION = "templateLocation";
