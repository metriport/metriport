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

var merge = require("./resourceMerger").merge;

module.exports.Process = function (jsonObj) {
  try {
    const encounters = jsonObj.entry.filter(entry => {
      return entry.resource.resourceType === "Encounter";
    });

    const idMap = new Set();
    const duplicateIds = [];
    encounters.forEach(enc => {
      enc.resource.identifier.forEach(id => {
        if (idMap.has(id.value)) {
          duplicateIds.push(id.value);
        } else {
          idMap.add(id.value);
        }
      });
    });

    if (duplicateIds.length) {
      for (const duplicateId of duplicateIds) {
        const duplicateEncounters = encounters.filter(enc => {
          return enc.resource.identifier.some(id => id.value === duplicateId);
        });
        const enc1 = duplicateEncounters[0];
        const enc2 = duplicateEncounters[1];
        const mergedEncounter = merge(enc1, enc2);

        const deduplicatedIdentifiers = deduplicateIdentifiers(mergedEncounter.resource.identifier);
        mergedEncounter.resource.identifier = deduplicatedIdentifiers;
        mergedEncounter.status = selectMostInformativeStatus(enc1.status, enc2.status);

        const entriesWithoutDuplicateEncounters = jsonObj.entry.filter(entry => {
          const includes = [enc1.resource.id, enc2.resource.id].includes(entry.resource.id);
          return !includes;
        });

        jsonObj.entry = [...entriesWithoutDuplicateEncounters, mergedEncounter];
        jsonObj.entry = JSON.parse(
          JSON.stringify(jsonObj.entry).replaceAll(enc1.resource.id, mergedEncounter.resource.id)
        );
      }
    }
    return jsonObj;
  } catch (err) {
    return jsonObj;
  }
};

function deduplicateIdentifiers(identifiers) {
  const identifierMap = {};

  identifiers.forEach(identifier => {
    const key = `${identifier.system}-${identifier.value}`;
    if (!identifierMap[key]) {
      identifierMap[key] = identifier;
    } else {
      const existingFields = Object.keys(identifierMap[key]).length;
      const newFields = Object.keys(identifier).length;
      if (newFields > existingFields) {
        identifierMap[key] = identifier;
      }
    }
  });

  return Object.values(identifierMap);
}

function selectMostInformativeStatus(status1, status2) {
  if (status1 === status2) {
    return status1;
  }
  return [status1, status2].filter(status => status !== "unknown")[0] || "unknown";
}

module.exports.deduplicateIdentifiers = deduplicateIdentifiers;
module.exports.selectMostInformativeStatus = selectMostInformativeStatus;
