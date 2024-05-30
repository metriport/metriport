// -------------------------------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License (MIT). See LICENSE in the repo root for license information.
// -------------------------------------------------------------------------------------------------

const selectMostInformativeStatus = require("../resourceDeduplicator").selectMostInformativeStatus;

const statusUnknown = "unknown";
const statusActive = "finished";
const statusCancelled = "cancelled";

describe("selectMostInformativeStatus", function () {
  it("return the status if both are the same", function (done) {
    const result = selectMostInformativeStatus(statusActive, statusActive);
    expect(result).toEqual(statusActive);
    done();
  });

  it("return active if the other is unknown", function (done) {
    const result = selectMostInformativeStatus(statusActive, statusUnknown);
    expect(result).toEqual(statusActive);
    done();
  });

  it("return the first one if both are different and not unknown", function (done) {
    const result1 = selectMostInformativeStatus(statusActive, statusCancelled);
    expect(result1).toEqual(statusActive);
    const result2 = selectMostInformativeStatus(statusCancelled, statusActive);
    expect(result2).toEqual(statusCancelled);
    done();
  });
});
