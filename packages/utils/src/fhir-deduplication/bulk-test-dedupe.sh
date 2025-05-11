#!/bin/bash

SKIP_DOWNLOADS=false
FILE_COUNT=100
BASE_DIR=""

# Function to display help
show_help() {
  cat << EOF
NAME
    $(basename "$0") - Download and deduplicate medical documents from S3

SYNOPSIS
    $(basename "$0") [OPTIONS] <base_directory>

DESCRIPTION
    This script downloads nondeduplicated files from S3 and generates
    deduplicated baseline files for comparison between master and
    feature branches.

    The script performs four main steps:
    1. Search for nondeduplicated files in S3
    2. Download the found files
    3. Generate deduplicated baseline files from master branch
    4. Generate deduplicated files from current feature branch

OPTIONS
    --help, -h
        Display this help message and exit

    --skip-downloads
        Skip steps 1 and 2 (searching and downloading files from S3).
        Use this option when files have already been downloaded.

ARGUMENTS
    base_directory
        Required. The base directory path where the script will operate.
        The script will create subdirectories under packages/utils/runs/

NOTES
    - The script requires AWS CLI to be configured with appropriate
      credentials for accessing the S3 bucket
    - Git must be installed and configured
    - NPM must be available for building the project
    - GNU parallel is required for parallel downloads

EOF
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --help|-h)
      show_help
      exit 0
      ;;
    --skip-downloads)
      SKIP_DOWNLOADS=true
      shift
      ;;
    *)
      if [ -z "$BASE_DIR" ]; then
        BASE_DIR="$1"
      fi
      shift
      ;;
  esac
done

# Check if base directory argument is provided
if [ -z "$BASE_DIR" ]; then
  echo "Error: Base directory path is required."
  echo "Usage: $0 [--skip-downloads] <base_directory>"
  exit 1
fi

# Store base directory
BASE_DIR="${BASE_DIR%/}" 1>/dev/null 2>&1
featurebranch=$(git rev-parse --abbrev-ref HEAD)
run_path="$BASE_DIR/packages/utils/runs/bulk-test-dedupe"
unprocessed_path="$run_path/unprocessed"
master_path="$run_path/master-processed"
featurebranch_path="$run_path/featurebranch-processed"

# Check for required b on pathinaries
check_required_binaries() {
  local missing_binaries=()

  # Check for AWS CLI
  if ! command -v aws &> /dev/null; then
    missing_binaries+=("aws (AWS CLI)")
  fi

  # Check for Git
  if ! command -v git &> /dev/null; then
    missing_binaries+=("git")
  fi

  # Check for NPM
  if ! command -v npm &> /dev/null; then
    missing_binaries+=("npm")
  fi

  # Check for Node.js
  if ! command -v node &> /dev/null; then
    missing_binaries+=("node (Node.js)")
  fi

  # Check for GNU parallel
  if ! command -v parallel &> /dev/null; then
    missing_binaries+=("parallel (GNU parallel)")
  fi

  # Check for jq
  if ! command -v jq &> /dev/null; then
    missing_binaries+=("jq")
  fi

  # Check for difft
  if ! command -v difft &> /dev/null; then
    missing_binaries+=("difft")
  fi

  # If any binaries are missing, print error and exit
  if [ ${#missing_binaries[@]} -ne 0 ]; then
    echo "Error: The following required binaries are not installed:"
    for binary in "${missing_binaries[@]}"; do
      echo "  - $binary"
    done
    echo ""
    echo "Please install the missing binaries before running this script."
    echo ""
    echo "Installation hints:"
    echo "  - AWS CLI: https://aws.amazon.com/cli/"
    echo "  - Git: https://git-scm.com/downloads"
    echo "  - Node.js and npm: https://nodejs.org/"
    echo "  - GNU parallel: brew install parallel (macOS) or apt-get install parallel (Linux)"
    echo "  - jq: brew install jq (macOS) or apt-get install jq (Linux)"
    echo "  - difft: https://difftastic.wilfred.me.uk/installation"
    exit 1
  fi
}

# Check for required binaries before proceeding
check_required_binaries

cancelation_cleanup() {
    cleanup

    pkill -P $$ 2>/dev/null

    # Then kill the specific AWS process if it exists
    if [ -n "$pid" ] && kill -0 $pid 2>/dev/null; then
        kill -9 $pid 2>/dev/null
        wait $pid 2>/dev/null || true
    fi

    echo ""
    echo -e "\n>>> CANCELLED"

    exit 0
}

# Define cleanup function first
cleanup() {
  cd $run_path
  # First send SIGTERM to all children of this script
  rm nondeduplicated-files.tsv
  update_samples_folder_path "" 1>/dev/null 2>&1
  git checkout $featurebranch 1>/dev/null 2>&1
  popd 1>/dev/null 2>&1
}

# Function to update the samplesFolderPath in dedup-files.ts
update_samples_folder_path() {
  local path_value="$1"
  local dedup_file="$BASE_DIR/packages/utils/src/fhir-deduplication/dedup-files.ts"

  # Update the samplesFolderPath line
  # This uses sed to replace the line containing 'const samplesFolderPath = ""'
  sed -i '' "s|const samplesFolderPath = \".*\"|const samplesFolderPath = \"$path_value\"|" "$dedup_file"

  printf "\r\033[K"
  printf "Updated samplesFolderPath to: \"$path_value\""
}

wait_and_wipe_prior_runs() {
  printf ">>> Deleting all outputs from past runs in 10s...\n"
  printf ">>> Press Ctrl+C to cancel\n"
  sleep  10
  printf ">>> Deleting...\n"

  rm -rf unprocessed
  rm -rf master-processed
  rm -rf featurebranch-processed

  mkdir -p unprocessed
  mkdir -p master-processed
  mkdir -p featurebranch-processed

  echo ""
  echo ""
}


# Step 1: Search for nondeduplicated files
search_nondeduplicated_files() {
  echo ">>> 1. Searching for nondeduplicated files in S3 from the last 2 weeks..."

  # Start list objects query
  {
    aws s3api list-objects-v2 \
      --bucket metriport-medical-documents \
      --prefix "" \
      --query "Contents[?LastModified>='$(date -v-14d +%Y-%m-%d)'].[Key,LastModified,Size]" \
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
    if [ "$current_count" -ge $FILE_COUNT ]; then
      break
    fi

    sleep 0.5
  done

  found_count=$(wc -l < nondeduplicated-files.tsv)
  if [ "$found_count" -lt "$FILE_COUNT" ]; then
      echo "WARNING: Only $found_count files found for the last 2 weeks, continuing with $found_count files"
  fi

  echo ""
  echo ""
}

# Step 2: Download nondeduplicated files
download_nondeduplicated_files() {
  echo ">>> 2. Downloading nondeduplicated files"

  mkdir -p unprocessed

  awk '{print $1}' nondeduplicated-files.tsv | head -$found_count |  \
      parallel -j 10 --bar \
      'aws s3 cp "s3://metriport-medical-documents/{}" "unprocessed/$(basename {})" >/dev/null 2>&1'

  downloadedcount=$(ls unprocessed | wc -l)

  echo "Download complete: $downloadedcount files downloaded to $(echo $BASE_DIR)/unprocessed/"
  echo ""
}

# Step 3: Generate deduplicated baseline files from master branch
generate_baseline_from_master() {
  git checkout master 1>/dev/null 2>&1
  echo ">>> 3. Generating deduplicated baseline files based on \`master\` branch"

  printf "\r\033[K"
  printf "Running \`git fetch\`..."
  git fetch 1>/dev/null 2>&1

  printf "\r\033[K"
  printf "Pulling \`master\`..."
  git pull 1>/dev/null 2>&1

  printf "\r\033[K"
  printf "Running \`npm run build\` in /core..."
  pushd $BASE_DIR/packages/core 1>/dev/null 2>&1
  npm run build 1>/dev/null 2>&1
  popd 1>/dev/null 2>&1

  printf "\r\033[K"
  printf "Running \`npm run build\` in /utils..."
  pushd $BASE_DIR/packages/utils 1>/dev/null 2>&1
  npm run build 1>/dev/null 2>&1
  popd 1>/dev/null 2>&1

  printf "\r\033[K"
  printf "Running deduplication script on master: \`src/fhir-deduplication/dedup-files.ts\`..."
  update_samples_folder_path "$unprocessed_path" 1>/dev/null 2>&1
  npx ts-node src/fhir-deduplication/dedup-files.ts 1>/dev/null 2>&1
  update_samples_folder_path "" 1>/dev/null 2>&1

  printf "\r\033[K"
  printf "Moving master-processed files to \`.../runs/bulk-test-dedupe/master-processed/\`..."
  mv unprocessed/*_deduped.json master-processed/
  sleep 1

  echo ""
  echo ""
}

# Step 4: Generate deduplicated files from feature branch
generate_from_feature_branch() {
  git checkout $featurebranch 1>/dev/null 2>&1
  echo ">>> 4. Generating deduplicated files from \`$featurebranch\`"

  printf "\r\033[K"
  printf "Pulling \`$featurebranch\`..."
  git pull origin $featurebranch 1>/dev/null 2>&1

  printf "\r\033[K"
  printf "Running \`npm run build\` in /core..."
  pushd $BASE_DIR/packages/core 1>/dev/null 2>&1
  npm run build 1>/dev/null 2>&1
  popd 1>/dev/null 2>&1

  printf "\r\033[K"
  printf "Running \`npm run build\` in /utils..."
  pushd $BASE_DIR/packages/utils 1>/dev/null 2>&1
  npm run build 1>/dev/null 2>&1
  popd 1>/dev/null 2>&1

  printf "\r\033[K"
  printf "Running deduplication script on $featurebranch: \`src/fhir-deduplication/dedup-files.ts\`..."
  update_samples_folder_path "$unprocessed_path" 1>/dev/null 2>&1
  npx ts-node src/fhir-deduplication/dedup-files.ts 1>/dev/null 2>&1
  update_samples_folder_path "" 1>/dev/null 2>&1

  printf "\r\033[K"
  printf "Moving featurebranch-processed files to \`.../runs/bulk-test-dedupe/featurebranch-processed/\`..."
  mv unprocessed/*_deduped.json featurebranch-processed/
  sleep 1

  echo ""
  echo ""
}

# Step 5: Compare master vs. featurebranch outputs
diff_master_and_featurebranch_outputs() {
  git checkout $featurebranch 1>/dev/null 2>&1
  echo ">>> 5. Diffing master and featurebranch dedupe outputs"

  # Clear diff_outputs.txt if it exists
  rm -f diff_outputs.txt
  touch diff_outputs.txt

  counter=0

  # Loop through all files in master-processed directory
  for file in master-processed/*_deduped.json; do
    # Extract the base filename
    basename_file=$(basename "$file")

    # Check if corresponding file exists in featurebranch-processed
    if [ -f "featurebranch-processed/$basename_file" ]; then
      counter=$((counter + 1))

      printf "\r\033[K"
      printf "Processing %d of $($found_count || $FILE_COUNT): %s" "$counter" "$basename_file"

      # Add a header for this file in the diff output
      echo "=== Diff for: $basename_file ===" >> diff_outputs.txt

      # Use process substitution to pipe jq output directly to difft
      (difft \
          <(cat "$file" | jq .) \
          <(cat "featurebranch-processed/$basename_file" | jq .) \
      ) >> diff_outputs.txt

      # Add a separator between files
      echo "" >> diff_outputs.txt
      echo "" >> diff_outputs.txt
    else
      echo "Warning: No matching file found for $basename_file in featurebranch-processed/" >> diff_outputs.txt
    fi
  done
}

# Set the trap for all signals
trap cancelation_cleanup SIGINT SIGTERM

###### Main execution #######
pushd $BASE_DIR 1>/dev/null 2>&1
mkdir -p packages/utils/runs/bulk-test-dedupe

mkdir -p unprocessed
mkdir -p master-processed
mkdir -p featurebranch-processed

pushd packages/utils/runs/bulk-test-dedupe 1>/dev/null 2>&1

echo "###########################################################"
echo "###       Running with params:                          ###"
echo "###       FILE_COUNT: $FILE_COUNT                               ###"
echo "###       SKIP_DOWNLOADS: $SKIP_DOWNLOADS                         ###"
echo "###                                                     ###"
echo "###       This script can take a long time to run!      ###"
echo "###########################################################"
echo ""

# Execute steps based on flags
if [ "$SKIP_DOWNLOADS" = true ]; then
  echo ">>> Skipping file downloads (steps 1 and 2)"
  echo ""
else
  wait_and_wipe_prior_runs
  search_nondeduplicated_files
  download_nondeduplicated_files
fi

# Always execute steps 3, 4, 5
generate_baseline_from_master
generate_from_feature_branch
diff_master_and_featurebranch_outputs

cleanup
exit 0
