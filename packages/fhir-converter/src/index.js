// -------------------------------------------------------------------------------------------------
// Copyright (c) 2022-present Metriport Inc.
//
// Licensed under AGPLv3. See LICENSE in the repo root for license information.
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//     Copyright (c) Microsoft Corporation. All rights reserved.
//
//     Permission to use, copy, modify, and/or distribute this software
//     for any purpose with or without fee is hereby granted, provided
//     that the above copyright notice and this permission notice appear
//     in all copies.
//
//     THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL
//     WARRANTIES WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED
//     WARRANTIES OF MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE
//     AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT, INDIRECT, OR
//     CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS
//     OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT,
//     NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR IN
//     CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
// -------------------------------------------------------------------------------------------------

require("events").EventEmitter.defaultMaxListeners = 20;
var express = require("express");
var app = require("./routes")(express());
var dayjs = require("dayjs");
var duration = require("dayjs/plugin/duration");

dayjs.extend(duration);

var port = process.env.PORT || 8080;

var server = app.listen(port, function () {
  var host = server.address().address;
  console.log(`NODE_OPTIONS=${process.env.NODE_OPTIONS}`);
  console.log("FHIR Converter listening at http://%s:%s", host, port);
});

var loadbalancerTimeout = dayjs.duration({ minutes: 15 }).asMilliseconds();
var oneSecond = dayjs.duration({ seconds: 1 }).asMilliseconds();

var timeout = loadbalancerTimeout - oneSecond;
server.setTimeout(timeout);

var keepalive = loadbalancerTimeout + oneSecond;
server.keepAliveTimeout = keepalive;
server.headersTimeout = keepalive + oneSecond;

/** Graceful shutdown: close the server on SIGTERM/SIGINT so the container stops cleanly. */
function shutdown(s) { 
  server.close(() => process.exit(0)); 
  setTimeout(() => process.exit(0), 5000); 
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));
