// -------------------------------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License (MIT). See LICENSE in the repo root for license information.
// -------------------------------------------------------------------------------------------------

const errorCodes = require("../error/error").errorCodes;
const errorMessage = require("../error/error").errorMessage;

const API_KEY_HEADER = "X-MS-CONVERSION-API-KEY";
const API_KEY_QUERY_PARAMETER = "code";
const API_KEY_ENVIRONMENT = "CONVERSION_API_KEYS";

var setValidApiKeys = function (keys) {
  if (
    !Array.isArray(keys) ||
    !keys.every(function (k) {
      return typeof k === "string";
    })
  ) {
    throw new Error("Keys must be an array of strings");
  }

  // Remove any empty strings and set keys
  validApiKeys = keys
    .map(function (s) {
      return s.trim();
    })
    .filter(function (e) {
      return e != "";
    });
};

var validateApiKey = function (req, res, next) {
  // If no api keys are defined, auth is not enforced
  if (validApiKeys.length == 0) {
    next();
  } else {
    if (req.query[API_KEY_QUERY_PARAMETER]) {
      if (validApiKeys.indexOf(req.query[API_KEY_QUERY_PARAMETER]) != -1) {
        res.cookie("key", req.query[API_KEY_QUERY_PARAMETER], { httpOnly: true, secure: true });
        next();
        return;
      }
    } else if (req.get(API_KEY_HEADER)) {
      if (validApiKeys.indexOf(req.get(API_KEY_HEADER)) != -1) {
        res.cookie("key", req.get(API_KEY_HEADER), { httpOnly: true, secure: true });
        next();
        return;
      }
    } else if (req.cookies.key && validApiKeys.indexOf(req.cookies.key) != -1) {
      res.cookie("key", req.cookies.key, { httpOnly: true, secure: true });
      next();
      return;
    }

    // We are enforcing auth and no valid key has been found
    res.status(401);
    res.json(
      errorMessage(
        errorCodes.Unauthorized,
        "No valid API key provided. Please set " +
          API_KEY_HEADER +
          " header field or " +
          API_KEY_QUERY_PARAMETER +
          " query parameter."
      )
    );
  }
};

// Build array of valid keys
var validApiKeys = [];
setValidApiKeys((process.env[API_KEY_ENVIRONMENT] || "").split(";"));

module.exports = {
  validateApiKey: validateApiKey,
  setValidApiKeys: setValidApiKeys,
  API_KEY_HEADER: API_KEY_HEADER,
  API_KEY_QUERY_PARAMETER: API_KEY_QUERY_PARAMETER,
};
