// -------------------------------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License (MIT). See LICENSE in the repo root for license information.
// -------------------------------------------------------------------------------------------------

let jsonProcessor = require("../outputProcessor/jsonProcessor");
let resourceMerger = require("../outputProcessor/resourceMerger");

module.exports = class dataHandler {
  constructor(dataType) {
    this.dataType = dataType;
  }

  parseSrcData(data) {
    return new Promise(fulfill => {
      fulfill(data);
    });
  }

  preProcessTemplate(templateStr) {
    return templateStr;
  }

  postProcessResult(inResult) {
    return resourceMerger.Process(JSON.parse(jsonProcessor.Process(inResult)));
  }

  getConversionResultMetadata() {
    return {};
  }
};
