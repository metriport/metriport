// // -------------------------------------------------------------------------------------------------
// // Copyright (c) Microsoft Corporation. All rights reserved.
// // Licensed under the MIT License (MIT). See LICENSE in the repo root for license information.
// // -------------------------------------------------------------------------------------------------

// var fse = require("fs-extra");
// var NodeGit = require("nodegit");
// var path = require("path");
// var Promise = require("promise");

// // We are using a slightly updated version of https://github.com/substack/pushover
// // Available at https://github.com/mangoraft/pushover
// var pushover = require("pushover-giting");

// // Module variables
// var repos;
// var repoPath;
// var reposRoot;
// var repoName;
// var repoInstance;

// module.exports = function (repositoryPath) {
//   setRepoPath(repositoryPath);

//   return {
//     repoPath: repoPath,
//     repoName: repoName,
//     repos: repos,
//     getRepository: getRepository,
//     getStatus: getStatus,
//     getBranches: getBranches,
//     createBranch: createBranch,
//     checkoutBranch: checkoutBranch,
//     setRepoPath: setRepoPath,
//     commitAllChanges: commitAllChanges,
//   };
// };

// var setRepoPath = function (repositoryPath) {
//   repoPath = repositoryPath;
//   reposRoot = path.join(repositoryPath, "../");
//   repoName = path.basename(repositoryPath);
//   repos = pushover(reposRoot);

//   // Invalidate a cached reference
//   repoInstance = undefined;
// };

// var getRepository = function () {
//   return new Promise(function (fulfill, reject) {
//     if (repoInstance) {
//       fulfill(repoInstance);
//     } else {
//       // Create path if doesn't exist
//       fse
//         .ensureDir(repoPath)
//         .then(function () {
//           // Try to open the repo
//           return NodeGit.Repository.open(repoPath);
//         })
//         .then(
//           function (repo) {
//             // Success, we will just pass it on
//             repoInstance = repo;
//             return repo;
//           },
//           function () {
//             // This is not a repo, so let's initialize it
//             return new Promise(function (innerFulfill, innerReject) {
//               NodeGit.Repository.init(repoPath, 0).then(
//                 repo => {
//                   innerFulfill(repo);
//                 },
//                 function (err) {
//                   innerReject(err);
//                 }
//               );
//             });
//           }
//         )
//         .then(
//           function (repo) {
//             repoInstance = repo;
//             fulfill(repo);
//           },
//           function (err) {
//             reject(err);
//           }
//         );
//     }
//   });
// };

// var getStatus = function () {
//   return new Promise(function (fulfill, reject) {
//     getRepository()
//       .then(function (repo) {
//         repo.getStatus().then(function (statuses) {
//           fulfill(
//             statuses.map(s => {
//               return { path: s.path(), status: statusToObj(s) };
//             })
//           );
//         });
//       })
//       .catch(function (err) {
//         reject(err);
//       });
//   });
// };

// var getBranches = function () {
//   var branches = [];
//   var repository;
//   var currentBranch;
//   return new Promise(function (fulfill, reject) {
//     getRepository()
//       .then(async repo => {
//         repository = repo;
//         return repository.getCurrentBranch();
//       })
//       .then(
//         function (current) {
//           currentBranch = current;
//         },
//         function () {
//           // we can ignore, no current branch (no branches in empty repo)
//         }
//       )
//       .then(function () {
//         return NodeGit.Repository.getReferences(repository, NodeGit.Reference.TYPE.ALL);
//       })
//       .then(function (references) {
//         for (var i = 0; i < references.length; i++) {
//           if (references[i].isBranch()) {
//             branches.push({
//               name: references[i].shorthand(),
//               active: currentBranch == references[i].name(),
//             });
//           }
//         }
//         branches.sort((a, b) => {
//           return a.name.localeCompare(b.name);
//         });
//         fulfill(branches);
//       })
//       .catch(function (err) {
//         reject(err);
//       });
//   });
// };

// var createBranch = function (branchName, baseBranch) {
//   return new Promise(function (fulfill, reject) {
//     var repository;
//     getRepository()
//       .then(function (repo) {
//         repository = repo;
//         if (baseBranch) {
//           // Try to get branch
//           return NodeGit.Reference.nameToId(repository, "refs/heads/" + baseBranch);
//         } else {
//           // Create a new branch on head
//           return repository.getHeadCommit();
//         }
//       })
//       .then(function (commit) {
//         return repository.createBranch(branchName, commit, 0);
//       })
//       .then(function () {
//         fulfill();
//       })
//       .catch(function (errReason) {
//         reject(errReason);
//       });
//   });
// };

// var checkoutBranch = function (branchName) {
//   return new Promise(function (fulfill, reject) {
//     var repository;
//     getRepository()
//       .then(function (repo) {
//         repository = repo;
//         return repository.getBranch("refs/heads/" + branchName);
//       })
//       .then(function (branch) {
//         return repository.checkoutRef(branch);
//       })
//       .then(function () {
//         fulfill();
//       })
//       .catch(function (errReason) {
//         reject(errReason);
//       });
//   });
// };

// var commitAllChanges = function (message, name, email) {
//   var theMessage = message || "converter service commit";
//   var theName = name || "converter service";
//   var theEmail = email || "service@convert.mshapis.com";

//   var theSignature = NodeGit.Signature.now(theName, theEmail);

//   return new Promise(function (fulfill, reject) {
//     var repository;
//     var index;
//     var oid;
//     var parentList = [];

//     getRepository()
//       .then(function (repo) {
//         repository = repo;
//         return repository.refreshIndex();
//       })
//       .then(function (indexResult) {
//         index = indexResult;
//         return index
//           .addAll()
//           .then(function () {
//             return index.write();
//           })
//           .then(function () {
//             return index.writeTree();
//           });
//       })
//       .then(function (oidResult) {
//         oid = oidResult;

//         // We need to investigate if there are references in the repo. If not trying to get a reference to HEAD will fail
//         // https://github.com/nodegit/nodegit/issues/213
//         return new Promise(function (fulfill) {
//           NodeGit.Reference.nameToId(repository, "HEAD")
//             .then(
//               // We have some commits in this repo
//               function (head) {
//                 return repository.getCommit(head);
//               },
//               // There are no commits in this repo
//               function () {
//                 fulfill(parentList);
//               }
//             )
//             .then(function (parent) {
//               parentList = [parent];
//               fulfill(parentList);
//             });
//         });
//       })
//       .then(function (parentList) {
//         return repository
//           .createCommit("HEAD", theSignature, theSignature, theMessage, oid, parentList)
//           .then(function () {
//             fulfill();
//           });
//       })
//       .catch(function (errReason) {
//         reject(errReason);
//       });
//   });
// };

// function statusToObj(status) {
//   return {
//     isNew: status.isNew() > 0,
//     isModified: status.isModified() > 0,
//     isTypechange: status.isTypechange() > 0,
//     isRenamed: status.isRenamed() > 0,
//     isIgnored: status.isIgnored() > 0,
//   };
// }
