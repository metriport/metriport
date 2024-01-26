// // -------------------------------------------------------------------------------------------------
// // Copyright (c) Microsoft Corporation. All rights reserved.
// // Licensed under the MIT License (MIT). See LICENSE in the repo root for license information.
// // -------------------------------------------------------------------------------------------------

// var fse = require("fs-extra");
// var path = require("path");
// var repoRootPath = path.join(__dirname, "test-repos-root");
// var gfs = require("./git-filesystem")(repoRootPath);
// var NodeGit = require("nodegit");

// before(function () {
//   fse.removeSync(repoRootPath);
// });

// after(function () {
//   fse.removeSync(repoRootPath);
// });

// describe("git-filesystem (initialization and status)", function () {
//   // This test set validates that we can get a repo reference to
//   // 1. A non existing folder (create first).
//   // 2. An existing empty folder.
//   // 3. An existing folder with a file in it.
//   // 4. An existing git repository.

//   const repoPath1 = path.join(repoRootPath, "repo1");
//   const repoPath2 = path.join(repoRootPath, "repo2");
//   const repoPath3 = path.join(repoRootPath, "repo3");

//   before(function () {
//     fse.ensureDirSync(repoPath2);

//     fse.ensureDirSync(repoPath3);
//     fse.writeFileSync(path.join(repoPath3, "file.txt"), "some text");
//   });

//   it("should return a repository reference for non-existing path (create path and repo)", function (done) {
//     gfs.setRepoPath(repoPath1);
//     gfs.getRepository().then(function (repo) {
//       if (repo) {
//         done();
//       } else {
//         done(new Error("Repository not returned."));
//       }
//     });
//   });

//   it("should return a empty array status for repo with no new files", function (done) {
//     gfs.setRepoPath(repoPath1);
//     gfs.getStatus().then(function (status) {
//       if (Array.isArray(status) & (status.length == 0)) {
//         done();
//       } else {
//         done(new Error("Status should be an empty array"));
//       }
//     });
//   });

//   it("should return a repository reference for existing path (init repo)", function (done) {
//     gfs.setRepoPath(repoPath2);
//     gfs.getRepository().then(function (repo) {
//       if (repo) {
//         done();
//       } else {
//         done(new Error("Repository not returned."));
//       }
//     });
//   });

//   it("should return a repository reference for existing path with files (init repo)", function (done) {
//     gfs.setRepoPath(repoPath3);
//     gfs.getRepository().then(function (repo) {
//       if (repo) {
//         done();
//       } else {
//         done(new Error("Repository not returned."));
//       }
//     });
//   });

//   it("should return a non-empty (array) status for repo with new files", function (done) {
//     gfs.setRepoPath(repoPath3);
//     gfs.getStatus().then(function (status) {
//       if (Array.isArray(status) && status.length == 1) {
//         done();
//       } else {
//         done(new Error("Status should an array with 1 element"));
//       }
//     });
//   });

//   it("should return a non-empty (array) status for CACHED repo with new files", function (done) {
//     // Inherit the repo path from above, should be cached -> Removed gfs.setRepoPath(repoPath3);
//     gfs.getStatus().then(function (status) {
//       if (Array.isArray(status) && status.length > 0) {
//         done();
//       } else {
//         done(new Error("Status should not be empty or undefined"));
//       }
//     });
//   });

//   it("should return a repository reference for existing repo (open)", function (done) {
//     gfs.setRepoPath(repoPath2); // Should be created now
//     gfs.getRepository().then(function (repo) {
//       if (repo) {
//         done();
//       } else {
//         done(new Error("Repository not returned."));
//       }
//     });
//   });

//   it("should return an error when using an invalid repo path", function (done) {
//     gfs.setRepoPath("//");
//     gfs.getStatus().then(
//       function () {
//         done(new Error("We should not be getting a repo back"));
//       },
//       function () {
//         done();
//       }
//     );
//   });

//   after(function () {
//     fse.removeSync(repoPath1);
//     fse.removeSync(repoPath2);
//     fse.removeSync(repoPath3);
//   });
// });

// describe("git-filesystem (commit)", function () {
//   const repoPath = path.join(repoRootPath, "repo1");

//   before(function () {
//     fse.ensureDirSync(repoPath);
//     fse.writeFileSync(path.join(repoPath, "file.txt"), "some text");
//     gfs.setRepoPath(repoPath);
//   });

//   it("status should have changes before commit", function (done) {
//     gfs
//       .getStatus()
//       .then(function (status) {
//         if (!Array.isArray(status) || status.length == 0) {
//           done(new Error("There are no changes in array but there should be."));
//         } else {
//           done();
//         }
//       })
//       .catch(function (errReason) {
//         done(errReason);
//       });
//   });

//   it("status should be empty after commit", function (done) {
//     gfs
//       .commitAllChanges()
//       .then(function () {
//         gfs
//           .getStatus()
//           .then(function (status) {
//             if (!Array.isArray(status) || status.length != 0) {
//               console.log("Status: " + JSON.stringify(status));
//               done(new Error("Status is not an empty array"));
//             } else {
//               done();
//             }
//           })
//           .catch(function (errReason) {
//             done(errReason);
//           });
//       })
//       .catch(function (errReason) {
//         done(errReason);
//       });
//   });

//   it("should be possible to add more files and commits after first commit", function (done) {
//     //This test ensure that the path for commit creating with existing references is working.

//     fse.writeFileSync(path.join(repoPath, "file2.txt"), "some more text");

//     gfs
//       .commitAllChanges()
//       .then(function () {
//         done();
//       })
//       .catch(function (errReason) {
//         done(errReason);
//       });
//   });

//   it("should fail to commit with invalid repo path", function (done) {
//     gfs.setRepoPath("//");

//     gfs
//       .commitAllChanges()
//       .then(function () {
//         done(new Error("It should not be allowed to commit changed to invalid repo"));
//       })
//       .catch(function () {
//         // This is correct, we should fail
//         done();
//       });
//   });

//   after(function () {
//     fse.removeSync(repoPath);
//   });
// });

// describe("git-filesystem (branches)", function () {
//   const repoPath = path.join(repoRootPath, "repo1");

//   before(function () {
//     fse.ensureDirSync(repoPath);
//     fse.writeFileSync(path.join(repoPath, "file.txt"), "some text");
//     gfs.setRepoPath(repoPath);
//   });

//   it("should contain no branches immediately after init", function (done) {
//     gfs
//       .getBranches()
//       .then(function (branches) {
//         if (branches.length == 0) {
//           done();
//         } else {
//           done(new Error("branches array is not zero length"));
//         }
//       })
//       .catch(function (errReason) {
//         console.log(errReason);
//         done(new Error(errReason));
//       });
//   });

//   it("should contain a single master branch after first commit", function (done) {
//     gfs
//       .commitAllChanges()
//       .then(function () {
//         return gfs.getBranches();
//       })
//       .then(function (branches) {
//         if (
//           branches.length == 1 &&
//           branches
//             .map(b => {
//               return b.name;
//             })
//             .includes("master")
//         ) {
//           done();
//         } else {
//           done(new Error("branches array does not contain a single master branch"));
//         }
//       })
//       .catch(function (errReason) {
//         console.log(errReason);
//         done(new Error(errReason));
//       });
//   });

//   it("should only include branches in list (e.g. no tags)", function (done) {
//     var repository;
//     gfs
//       .getRepository()
//       .then(function (repo) {
//         repository = repo;
//         return repository.getHeadCommit();
//       })
//       .then(function (commit) {
//         return repository.createTag(commit, "myTag", "myTag created");
//       })
//       .then(function () {
//         return gfs.getBranches();
//       })
//       .then(function (branches) {
//         if (
//           branches.length == 1 &&
//           branches
//             .map(b => {
//               return b.name;
//             })
//             .includes("master")
//         ) {
//           done();
//         } else {
//           done(new Error("branches array does not contain a single master branch"));
//         }
//       })
//       .catch(function (errReason) {
//         done(new Error(errReason));
//       });
//   });

//   it("should contain two branches after creating a new branch", function (done) {
//     var branchName = "newBranch";
//     gfs
//       .createBranch(branchName)
//       .then(function () {
//         gfs
//           .getBranches()
//           .then(function (branches) {
//             if (
//               branches.length == 2 &&
//               branches
//                 .map(b => {
//                   return b.name;
//                 })
//                 .includes(branchName)
//             ) {
//               done();
//             } else {
//               done(new Error("Branch array does not contain 2 branches including new branch"));
//             }
//           })
//           .catch(function (errReason) {
//             done(new Error(errReason));
//           });
//       })
//       .catch(function (errReason) {
//         done(new Error(errReason));
//       });
//   });

//   it("should allow branched to be created based on an existing named branch.", function (done) {
//     gfs
//       .checkoutBranch("newBranch") // Created above
//       .then(function () {
//         // Add a file
//         fse.writeFileSync(path.join(repoPath, "file3.txt"), "some more text");
//         return gfs.commitAllChanges();
//       })
//       .then(function () {
//         return gfs.createBranch("newBranch2", "newBranch");
//       })
//       .then(function () {
//         return gfs.getRepository();
//       })
//       .then(function (repo) {
//         var commit1;
//         var commit2;
//         return NodeGit.Reference.nameToId(repo, "refs/heads/newBranch").then(function (commit) {
//           commit1 = commit;
//           return NodeGit.Reference.nameToId(repo, "refs/heads/newBranch2")
//             .then(function (commit) {
//               commit2 = commit;
//               return NodeGit.Reference.nameToId(repo, "refs/heads/master");
//             })
//             .then(function (masterCommit) {
//               if (
//                 commit1.tostrS() === commit2.tostrS() &&
//                 commit1.tostrS() != masterCommit.tostrS()
//               ) {
//                 done();
//               } else {
//                 done(new Error("Commits from new branch do not match."));
//               }
//             });
//         });
//       })
//       .catch(function (errReason) {
//         gfs.getBranches().then(function (branches) {
//           console.log(JSON.stringify(branches, null, 2));
//         });
//         done(new Error(errReason));
//       });
//   });

//   it("should fail to create branch with invalid name (containing :)", function (done) {
//     var branchName = "newBranch:newBranch";
//     gfs.createBranch(branchName).then(
//       function () {
//         // We should not succeed here, we have an invalid name
//         done(new Error("Creating branch with invalid name should not succeed"));
//       },
//       function () {
//         done();
//       }
//     );
//   });

//   it("should succeed when checking out existing branch", function (done) {
//     var branchName = "newBranch"; //Created above
//     gfs
//       .checkoutBranch(branchName)
//       .then(function () {
//         return gfs.getBranches();
//       })
//       .then(function (branches) {
//         var checkoutIsCurrent = false;
//         for (var i = 0; i < branches.length; i++) {
//           if (branches[i].name === branchName && branches[i].active) {
//             checkoutIsCurrent = true;
//           }
//         }

//         if (checkoutIsCurrent) {
//           done();
//         } else {
//           done(new Error("Checked out branch is not the current branch"));
//         }
//       })
//       .catch(function () {
//         done(new Error("Failed to checkout existing branch " + branchName));
//       });
//   });

//   it("should fail when trying to check out non-existent branch", function (done) {
//     var branchName = "nonExistingBranch"; //NOT Created above
//     gfs.checkoutBranch(branchName).then(
//       function () {
//         done(new Error("Checking out non-existing branch should fail"));
//       },
//       function () {
//         done(); //Failure here is correct.
//       }
//     );
//   });

//   it("should fail to list branches for invalid repository", function (done) {
//     gfs.setRepoPath("//");

//     gfs
//       .getBranches()
//       .then(function () {
//         done(new Error("It should not be possible to list branches for invalid repo"));
//       })
//       .catch(function () {
//         done(); //Correct, should fail
//       });
//   });

//   after(function () {
//     fse.removeSync(repoPath);
//   });
// });
