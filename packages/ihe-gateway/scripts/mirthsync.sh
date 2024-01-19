# From https://github.com/SagaHealthcareIT/mirthsync
#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'


## Apparently macOS readlink doesn't support the -f option. The following few
## lines are a workaround that use 'greadlink' if it's available.

_readlink=readlink

if type -p greadlink; then
    echo found greadlink in PATH
    _readlink=greadlink
fi

_dir=`dirname $($_readlink -f $0)`

## mostly from - https://stackoverflow.com/a/7335524 goal is to detect
## java version and potentially disable access warnings
if type -p java; then
    echo found java executable in PATH
    _java=java
elif [[ -n "$JAVA_HOME" ]] && [[ -x "$JAVA_HOME/bin/java" ]];  then
    echo found java executable in JAVA_HOME     
    _java="$JAVA_HOME/bin/java"
else
    echo "no java"
fi

if [[ "$_java" ]]; then
    version=$("$_java" -version 2>&1 | awk -F '"' '/version/ {print $2}')
    echo version "$version"
    # if [[ "$version" > "1.8" ]]; then
    #     $_java --illegal-access=permit -jar ${_dir}/lib/uberjar/mirthsync-3.1.0-standalone.jar $@
    # else         
        $_java -jar ${_dir}/mirthsync-3.1.0-standalone.jar $@
    # fi
fi
##
