// -------------------------------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License (MIT). See LICENSE in the repo root for license information.
// -------------------------------------------------------------------------------------------------
/* eslint-disable no-undef, no-unused-vars */
function loadGitMenu() {
  $.getJSON("/api/templates/git/status?code=" + getApiKey(), function (status) {
    $.getJSON("/api/templates/git/branches?code=" + getApiKey(), function (branches) {
      $("#git-dropdown").html("");
      if (status.length > 0) {
        $("#git-dropdown").append(
          '<a class="dropdown-item commit-link" href="#">Commit changes</a>'
        );
        $("#git-dropdown").on("click", "a.commit-link", function () {
          commitChanges();
        });
      } else {
        $("#git-dropdown").append('<a class="dropdown-item disabled">Commit changes (none)</a>');
      }
      $("#git-dropdown").append(
        '<a class="dropdown-item" data-toggle="modal" data-target="#new-branch-modal" href="#">New branch</a>'
      );
      $("#git-dropdown").append('<div class="dropdown-divider"></div>');
      $("#git-dropdown").append('<h6 class="dropdown-header">Branches</h6>');
      branches.forEach(function (b) {
        if (b.active) {
          $("#git-dropdown").append(
            '<a class="dropdown-item" href="#"><strong>' + b.name + "<strong></a>"
          );
        } else {
          $("#git-dropdown").append(
            '<a class="dropdown-item" href="#" onClick="checkoutBranch(\'' +
              b.name +
              "');\">" +
              b.name +
              "</a>"
          );
        }
      });
    });
  });
}

function loadBaseBranches() {
  $.getJSON("/api/templates/git/branches?code=" + getApiKey(), function (branches) {
    $("#base-branch-select").find("option").remove().end();
    branches.forEach(function (b) {
      $("#base-branch-select").append(new Option(b.name, b.name, null, b.active));
    });
  });
}

function createBranch(branchName, baseBranchName, checkoutBranchAfterCreate) {
  $("#new-branch-modal").modal("hide");
  $.ajax("/api/templates/git/branches", {
    data: JSON.stringify({ name: branchName, baseBranch: baseBranchName }),
    type: "POST",
    processData: false,
    contentType: "application/json",
    beforeSend: function (request) {
      request.setRequestHeader("X-MS-CONVERSION-API-KEY", getApiKey());
    },
    success: function () {
      loadGitMenu();
      if (checkoutBranchAfterCreate) {
        checkoutBranch(branchName);
      }
    },
    error: function (err) {
      console.error("Error creating branch: " + JSON.stringify(err));
      displayBanner("Error creating branch: " + JSON.stringify(err), "alert-danger");
    },
  });
}

function checkoutBranch(branchName) {
  $.ajax("/api/templates/git/checkout", {
    data: JSON.stringify({ name: branchName }),
    type: "POST",
    processData: false,
    contentType: "application/json",
    beforeSend: function (request) {
      request.setRequestHeader("X-MS-CONVERSION-API-KEY", getApiKey());
    },
    success: function () {
      refreshTemplateNames();
      loadGitMenu();
      if ($("#template-name-input").val()) {
        loadTemplate($("#template-name-input").val());
      }
    },
    error: function (err) {
      console.error("Error checking out branch: " + JSON.stringify(err));
      displayBanner("Error checking out branch: " + JSON.stringify(err), "alert-danger");
    },
  });
}

function commitChanges() {
  $.ajax("/api/templates/git/commit", {
    type: "POST",
    processData: false,
    contentType: "application/json",
    beforeSend: function (request) {
      request.setRequestHeader("X-MS-CONVERSION-API-KEY", getApiKey());
    },
    success: function () {
      refreshTemplateNames();
      loadGitMenu();
    },
    error: function (err) {
      console.error("Error commiting changes: " + JSON.stringify(err));
      displayBanner("Error commiting changes: " + JSON.stringify(err), "alert-danger");
    },
  });
}
