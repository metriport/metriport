#!/bin/bash

SOB=$(git var GIT_AUTHOR_IDENT | sed -n -E 's/^(.+>).*$/Signed-off-by: \1/p')
grep -qs "${SOB}" $1
RES=$?

if [ $RES -ne 0 ]; then
  echo ""
  echo "🚨 Missing commit sign-off!"
  echo " "
  echo "If you're using the terminal, add the -s option to the commit command."
  echo "If you're using VSCode, you can set the 'Always Sign Off' option in the settings."
  echo ""
  exit 1
fi

exit 0