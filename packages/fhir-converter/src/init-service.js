// -------------------------------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License (MIT). See LICENSE in the repo root for license information.
// -------------------------------------------------------------------------------------------------

var constants = require("./lib/constants/constants");
var fse = require("fs-extra");
// var gfs = require("./lib/git-filesystem/git-filesystem")(constants.TEMPLATE_FILES_LOCATION);
var path = require("path");

fse.ensureDir(constants.TEMPLATE_FILES_LOCATION).then(function () {
  if (
    fse.readdir(constants.TEMPLATE_FILES_LOCATION, function (err, files) {
      if (files.length == 0) {
        fse
          .copy(constants.BASE_TEMPLATE_FILES_LOCATION, constants.TEMPLATE_FILES_LOCATION)
          .then(function () {
            // Make sure we can get a status
            // gfs
            //   .getStatus()
            //   .then(function (status) {
            //     // If we have something in status and we have no branches, it means new repo and we should make an initial commit
            //     if (status.length > 0) {
            //       gfs.getBranches().then(function (branches) {
            //         if (branches.length == 0) {
            //           gfs
            //             .commitAllChanges("Initial commit")
            //             .then(function () {
            //               console.log("Committed initial commit");
            //             })
            //             .catch(function (errReasonCommit) {
            //               throw new Error("Do initial commits: " + errReasonCommit);
            //             });
            //         }
            //       });
            //     }
            //   })
            //   .catch(function (errReason) {
            //     throw new Error("Unable to initialize repo: " + errReason);
            //   });
          });
      } else {
        // The folder is not empty, but we should be able to open or make it a git repo
        // gfs.getStatus().catch(function (err) {
        //   throw new Error("Unable to initialize repo: " + err);
        // });

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
