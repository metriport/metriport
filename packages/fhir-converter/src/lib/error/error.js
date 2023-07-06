// -------------------------------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License (MIT). See LICENSE in the repo root for license information.
// -------------------------------------------------------------------------------------------------

// Error codes
const errorCodes = {
  BadRequest: "BadRequest",
  Conflict: "Conflict",
  NotFound: "NotFound",
  WriteError: "WriteError",
  Unauthorized: "Unauthorized",
};

module.exports.errorCodes = errorCodes;

// Error message
module.exports.errorMessage = function (errorCode, errorMessage) {
  return { error: { code: errorCode, message: errorMessage } };
};
