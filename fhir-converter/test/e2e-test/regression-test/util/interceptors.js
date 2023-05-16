// -------------------------------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License (MIT). See LICENSE in the repo root for license information.
// -------------------------------------------------------------------------------------------------
const _ = require("lodash");

class Interceptor {
  constructor(next) {
    this.__next = next;
  }

  handle(data) {
    if (!!this.__next && this.__next instanceof Interceptor) {
      return this.__next.handle(data);
    }
    return data;
  }
}

class DoNothingInterceptor extends Interceptor {
  handle(data) {
    return super.handle(data);
  }
}

class ExtraDynamicFieldInterceptor extends Interceptor {
  constructor(next) {
    super(next);
    this.__placeholder = "removed";
    this.__removeUUIDResourceTypes = [
      "DocumentReference",
      "Composition",
      "Immunization",
      "MedicationStatement",
      "Condition",
      "Observation",
    ];
  }

  handle(data) {
    if (!_.isPlainObject(data)) {
      return data;
    }
    data = this.__handle(data);
    return super.handle(data);
  }

  __handle(data) {
    if (!("entry" in data) || !_.isArray(data["entry"])) {
      return data;
    }
    const entries = data["entry"];

    for (const entry of entries) {
      if (!entry || !("resource" in entry) || !("resourceType" in entry["resource"])) {
        continue;
      }

      const resource = entry["resource"];
      this.__removeDocumentReference(resource);
      this.__removeSectionReferences(resource);
      this.__removeResourceIds(resource, entry);
    }
    return data;
  }

  __removeDocumentReference(resource) {
    if (resource["resourceType"] != "DocumentReference") {
      return;
    }
    resource["date"] = this.__placeholder;

    // The zlib.gzip result will be different on different platforms, see https://stackoverflow.com/questions/26516369/zlib-gzip-produces-different-results-for-same-input-on-different-oses.
    // Hence the hash result will be different too, which will trigger NodeJS CI error and need to be removed.

    if (!("content" in resource) || !_.isArray(resource["content"])) {
      return;
    }
    for (const ele of resource["content"]) {
      if ("attachment" in ele) {
        if ("hash" in ele["attachment"]) {
          ele["attachment"]["hash"] = "removed-hash";
        }
        if ("data" in ele["attachment"]) {
          ele["attachment"]["data"] = "removed-data";
        }
      }
    }
  }

  __removeSectionReferences(resource) {
    if (!("section" in resource)) {
      return;
    }
    for (const section of resource["section"]) {
      if ("entry" in section) {
        for (let i = 0; i < section["entry"].length; ++i) {
          const item = section["entry"][i];
          if (
            "reference" in item &&
            this.__removeUUIDResourceTypes.some(e => item["reference"].includes(e))
          ) {
            section["entry"][i] = this.__placeholder;
          }
        }
      }
    }
  }

  __removeResourceIds(resource, entry) {
    const request = "request" in entry ? entry["request"] : null;
    for (const rmUUIDType of this.__removeUUIDResourceTypes) {
      if (resource["resourceType"] != rmUUIDType) {
        continue;
      }

      entry["fullUrl"] = this.__placeholder;
      resource["id"] = this.__placeholder;

      if (request && "url" in request) {
        request["url"] = this.__placeholder;
      }
    }
  }
}

module.exports = {
  DoNothingInterceptor,
  ExtraDynamicFieldInterceptor,
};
