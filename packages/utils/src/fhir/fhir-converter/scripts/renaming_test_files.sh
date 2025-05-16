#!/bin/bash
## This script renames files and directories within a specified directory by hashing their names along with a secret passphrase. 
## This is useful for renaming data files whose names have sensitive information in them.


# Check if a directory name is provided
if [ "$#" -ne 1 ]; then
    echo "Usage: $0 <directory>"
    exit 1
fi

directory=$1

# Prompt for a secret passphrase
read -sp "Enter your secret passphrase: " passphrase
echo

# Function to hash names
hash_name() {
    echo -n "$1$passphrase" | shasum | cut -d' ' -f1
}

export -f hash_name
export passphrase

# Ensure the directory path is absolute
directory=$(realpath "$directory")

# Find and rename all subdirectories first
find "$directory" -mindepth 1 -type d | sort -r | while read -r dir; do
    parent_path=$(dirname "$dir")
    dir_name=$(basename "$dir")
    new_name=$(hash_name "$dir_name")
    mv "$dir" "$parent_path/$new_name"
done

# Then find and rename all files
find "$directory" -type f | while read -r file; do
    dir_path=$(dirname "$file")
    file_name=$(basename "$file")
    base_name="${file_name%.*}"
    extension="${file_name##*.}"
    new_base_name=$(hash_name "$base_name")
    if [ "$base_name" == "$extension" ]; then
        new_file_path="$dir_path/$new_base_name"
    else
        new_file_path="$dir_path/$new_base_name.$extension"
    fi
    mv "$file" "$new_file_path"
done