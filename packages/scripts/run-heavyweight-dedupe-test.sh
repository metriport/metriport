#!/bin/bash

# Check if base directory argument is provided
if [ -z "$1" ]; then
  echo "Error: Base directory path is required."
  echo "Usage: $0 <base_directory>"
  exit 1
fi

# Store base directory
BASE_DIR="$1" 1>/dev/null 2>&1
pushd $BASE_DIR 1>/dev/null 2>&1

# Define cleanup function first
cleanup() {
  # First send SIGTERM to all children of this script
  pkill -P $$ 2>/dev/null

  # Then kill the specific AWS process if it exists
  if [ -n "$pid" ] && kill -0 $pid 2>/dev/null; then
    kill -9 $pid 2>/dev/null
    wait $pid 2>/dev/null || true
  fi

  echo -e "\n>>> Search complete"
  exit 0
}

# Set the trap for all signals
trap cleanup SIGINT SIGTERM EXIT

echo "######################################################"
echo "##### This script takes approximately 10m to run #####"
echo "######################################################"
echo ""

echo ">>> 1. Searching for nondeduplicated files in S3"

# Start list objects query
{
  aws s3api list-objects-v2 \
    --bucket metriport-medical-documents \
    --prefix "" \
    --query "Contents[?LastModified>='$(date -v-1000d +%Y-%m-%d)'].[Key,LastModified,Size]" \
    --output text \
    | grep with-dup
} > nondeduplicated-files.tsv 2>/dev/null &
pid=$!

# Track list objects query
while kill -0 $pid 2>/dev/null; do
  current_count=$(wc -l < nondeduplicated-files.tsv 2>/dev/null || echo 0)

  # Move cursor to beginning of line and clear it
  printf "\r\033[K"
  printf "Searching: %6d files found" "$current_count"
  if [ "$current_count" -ge 10 ]; then
    break
  fi

  sleep 0.5
done

echo ""
echo ""

echo ">>> 2. Downloading nondeduplicated files"

mkdir -p s3_downloads

awk '{print $1}' nondeduplicated-files.tsv | head -1 | \
    parallel -j 10 --bar \
    'aws s3 cp "s3://metriport-medical-documents/{}" "s3_downloads/$(basename {})" >/dev/null 2>&1'

downloadedcount=$(ls s3_downloads | wc -l)

echo "Download complete: $downloadedcount files downloaded to $(echo $BASE_DIR)s3_downloads/"
echo ""


# Alternative approach using xargs for parallel downloads (uncomment to use)
# echo "Downloading files in parallel..."
# awk '{print $1}' nondeduplicated-files.tsv | xargs -P 4 -I {} aws s3 cp "s3://metriport-medical-documents/{}" "s3_downloads/"

git checkout master 1>/dev/null 2>&1
echo ">>> 3. Generating deduplicated baseline files based on \`master\` branch"

printf "\r\033[K"
printf "Running \`git fetch\`..."
git fetch 1>/dev/null 2>&1

printf "\r\033[K"
printf "Pulling \`master\`..."
git pull 1>/dev/null 2>&1

printf "\r\033[K"
printf "Running \`npm run build\`..."
npm run build 1>/dev/null 2>&1

printf "\r\033[K"
printf "Running \`SOME SCRIPT\`..."

echo ""
echo ""


git checkout -
echo ">>> 4. Generating deduplicated files from feature-branch \`$(git rev-parse --abbrev-ref HEAD)\`"

printf "\r\033[K"
printf "Running \`npm run build\`..."
npm run build 1>/dev/null 2>&1

printf "\r\033[K"
printf "Running \`SOME SCRIPT\`..."

# Triggers cleanup
popd
exit 0
