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

var constants = require("./lib/constants/constants");
var fse = require("fs-extra");
var path = require("path");

fse.ensureDir(constants.TEMPLATE_FILES_LOCATION).then(function () {
  if (
    fse.readdir(constants.TEMPLATE_FILES_LOCATION, function (err, files) {
      if (files.length == 0) {
        fse
          .copy(constants.BASE_TEMPLATE_FILES_LOCATION, constants.TEMPLATE_FILES_LOCATION)
          .then(function () {});
      } else {
        // delete any temp folders (ceeated by UpdateBaseTemplates)
        var existingFiles = fse.readdirSync(constants.TEMPLATE_FILES_LOCATION);
        existingFiles.forEach(function (fl) {
          try {
            if (fl.startsWith(".temp")) {
              let tempFolder = path.join(constants.TEMPLATE_FILES_LOCATION, fl);
              console.log(`removing ${tempFolder}`);
              fse.removeSync(tempFolder);
            }
          } catch (err) {
            console.log(`${fl} removal failed with error ${err}`);
          }
        });
      }
    })
  );
});
