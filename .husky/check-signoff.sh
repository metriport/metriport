#!/bin/bash

NPM_PUBLISH_MSG="chore(release): publish"
grep -qs "${NPM_PUBLISH_MSG}" $1 # returns 0 if found, 1 if not found
containsNpmPublishMessage=$?

SOB=$(git var GIT_AUTHOR_IDENT | sed -n -E 's/^(.+>).*$/Signed-off-by: \1/p')
grep -qs "${SOB}" $1 # returns 0 if found, 1 if not found
containsSignOffBy=$?

if [ $containsNpmPublishMessage -ne 0 ] && [ $containsSignOffBy -ne 0 ]; then
  commitMessage="$(cat $1)"
  echo ""
  echo "🚨 Missing commit sign-off!"
  echo " "
  echo "If you're using the terminal, add the -s option to the commit command."
  echo "If you're using VSCode, you can set the 'Always Sign Off' option in the settings."
  echo ""
  echo "Original commit message:"
  echo " "
  echo $commitMessage
  exit 1
fi

exit 0