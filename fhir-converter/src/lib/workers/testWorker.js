// -------------------------------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License (MIT). See LICENSE in the repo root for license information.
// -------------------------------------------------------------------------------------------------

var WorkerUtils = require("./workerUtils");
var Promise = require("promise");

WorkerUtils.workerTaskProcessor(msg => {
  return new Promise((fulfill, reject) => {
    switch (msg.TestOnly) {
      case "exit":
        process.exit(2);
        break;
      case "error":
        throw new Error("random error");
      case "msg1":
        fulfill("b");
        break;
      case "msg2":
        fulfill("c");
        break;
      default:
        reject("unknown msg!");
    }
  });
});
