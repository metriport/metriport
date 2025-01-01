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

var fs = require("fs");
var Handlebars = require("handlebars");
var helpers = require("./handlebars-helpers").external;

var handlebarsInstances = {};

module.exports.instance = function (
  createNew,
  dataHandler,
  templateFilesLocation,
  currentContextTemplatesMap
) {
  if (createNew) {
    handlebarsInstances = {};
  }

  let dataType = dataHandler.dataType;

  if (!handlebarsInstances[dataType]) {
    handlebarsInstances[dataType] = Handlebars.create();
    var origResolvePartial = handlebarsInstances[dataType].VM.resolvePartial;
    handlebarsInstances[dataType].VM.resolvePartial = function (partial, context, options) {
      if (!options.partials[options.name]) {
        try {
          var content;
          if (currentContextTemplatesMap && options.name in currentContextTemplatesMap) {
            content = currentContextTemplatesMap[options.name];
          } else {
            content = fs.readFileSync(templateFilesLocation + "/" + options.name);
          }
          var preprocessedContent = dataHandler.preProcessTemplate(content.toString());
          handlebarsInstances[dataType].registerPartial(options.name, preprocessedContent);

          // Need to set partial entry here due to a bug in Handlebars (refer # 70386).
          /* istanbul ignore else  */
          if (!options.partials[options.name]) {
            options.partials[options.name] = preprocessedContent;
          }
        } catch (err) {
          throw new Error(`Referenced partial template ${options.name} not found on disk : ${err}`);
        }
      }

      return origResolvePartial(partial, context, options);
    };

    helpers.forEach(h => {
      handlebarsInstances[dataType].registerHelper(h.name, h.func);
    });
  }

  return handlebarsInstances[dataType];
};
