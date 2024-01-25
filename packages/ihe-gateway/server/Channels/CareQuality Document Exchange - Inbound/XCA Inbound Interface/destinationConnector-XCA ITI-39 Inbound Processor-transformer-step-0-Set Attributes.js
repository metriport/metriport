// The Content-Type for the upstream channel
msg.*::Body.@ContentType = sourceMap.get('headers').getHeader('Content-Type');