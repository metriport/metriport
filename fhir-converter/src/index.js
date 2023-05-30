// -------------------------------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License (MIT). See LICENSE in the repo root for license information.
// -------------------------------------------------------------------------------------------------

require("events").EventEmitter.defaultMaxListeners = 20;
var express = require("express");
var app = require("./routes")(express());

var port = process.env.PORT || 8080;

var server = app.listen(port, function () {
  var host = server.address().address;
  console.log(`NODE_OPTIONS=${process.env.NODE_OPTIONS}`);
  console.log("FHIR Converter listening at http://%s:%s", host, port);
});
