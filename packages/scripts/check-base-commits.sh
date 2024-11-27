#!/bin/bash

# Exit on any error
set -e

main_branch="master"
run_on_branch="develop"

current_branch=$(git rev-parse --abbrev-ref HEAD)

# Only run checks if on develop branch
if [ "$current_branch" != "$run_on_branch" ]; then
    echo "✅ Skipping base commit check - not on branch $run_on_branch"
    exit 0
fi

# Get the common ancestor commit between current and main branch
merge_base=$(git merge-base $current_branch $main_branch)

# Find non-merge commits between merge-base and main branch
non_merge_commits=$(git log --no-merges $merge_base..$main_branch --oneline)

if [ -n "$non_merge_commits" ]; then
    echo "❌ Error: found non-merge commits on $main_branch branch:"
    echo "$non_merge_commits"
    exit 1
else
    echo "✅ No non-merge commits found on $main_branch branch"
    exit 0
fi
