#!/usr/bin/env python3
"""
Script to sort items in [Struct] and [root_paths] sections of .ini files alphabetically.
Keeps specific important rows at the top and bottom with separator lines.
Handles files that already have existing comment lines.
"""

import os
import re
from pathlib import Path

# Rows to keep at the top of each section
TOP_ROWS = [
    'resourcetype = resourceType',
    'id = id',
    'meta_versionid = meta.versionId',
    'meta_lastupdated = meta.lastUpdated',
    'meta_source = meta.source',
    'identifier_0_system = identifier.0.system',
    'identifier_0_value = identifier.0.value',
    'patient_reference = patient.reference',
    'subject_reference = subject.reference'
]

# Rows to keep at the bottom of [Struct] section only
STRUCT_BOTTOM_ROWS = [
    'filename = Filename:',
    'processed_date = GetDate:'
]

SEPARATOR_LINE = '# sort alphabetically from here on'
BOTTOM_SEPARATOR_LINE = '# end of alphabetical sorting'

def sort_ini_sections(file_path):
    """Sort items in [Struct] and [root_paths] sections alphabetically."""
    print(f"Processing: {file_path}")
    
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Split content into sections
    sections = re.split(r'(\[.*?\])', content)
    
    # Process each section
    for i in range(1, len(sections), 2):  # Skip section names, process content
        if i + 1 < len(sections):
            section_name = sections[i]
            section_content = sections[i + 1]
            
            # Check if this is a section we want to sort
            if section_name.strip() in ['[Struct]', '[root_paths]']:
                # Preserve original leading/trailing whitespace around the section content
                match = re.match(r'^(\s*)(.*?)(\s*)$', section_content, flags=re.DOTALL)
                leading_ws = match.group(1) if match else ''
                inner_content = match.group(2) if match else section_content
                trailing_ws = match.group(3) if match else ''
                
                # Split the inner content into lines and filter out empty lines
                lines = [line.strip() for line in inner_content.split('\n') if line.strip()]
                
                # Separate top rows, bottom rows (for Struct only), comment lines, and other rows
                top_rows_found = []
                bottom_rows_found = []
                comment_lines = []
                other_rows = []
                
                for line in lines:
                    if line in TOP_ROWS:
                        top_rows_found.append(line)
                    elif section_name.strip() == '[Struct]' and line in STRUCT_BOTTOM_ROWS:
                        bottom_rows_found.append(line)
                    elif line.startswith('#'):
                        comment_lines.append(line)
                    else:
                        other_rows.append(line)
                
                # Sort other rows alphabetically by the key (left side of =)
                sorted_other_rows = sorted(
                    other_rows,
                    key=lambda x: x.split('=')[0].strip() if '=' in x else x,
                )
                
                # Reconstruct the section content
                if section_name.strip() == '[Struct]':
                    # For Struct section: top rows + separator + sorted rows + bottom separator + bottom rows
                    if top_rows_found:
                        # Remove duplicates while preserving order
                        seen = set()
                        unique_top_rows = []
                        for row in top_rows_found:
                            if row not in seen:
                                seen.add(row)
                                unique_top_rows.append(row)
                        
                        if bottom_rows_found:
                            # Remove duplicates while preserving order
                            seen = set()
                            unique_bottom_rows = []
                            for row in bottom_rows_found:
                                if row not in seen:
                                    seen.add(row)
                                    unique_bottom_rows.append(row)
                            
                            section_lines = unique_top_rows + [SEPARATOR_LINE] + sorted_other_rows + [BOTTOM_SEPARATOR_LINE] + unique_bottom_rows
                        else:
                            section_lines = unique_top_rows + [SEPARATOR_LINE] + sorted_other_rows
                    else:
                        if bottom_rows_found:
                            # Remove duplicates while preserving order
                            seen = set()
                            unique_bottom_rows = []
                            for row in bottom_rows_found:
                                if row not in seen:
                                    seen.add(row)
                                    unique_bottom_rows.append(row)
                            
                            section_lines = sorted_other_rows + [BOTTOM_SEPARATOR_LINE] + unique_bottom_rows
                        else:
                            section_lines = sorted_other_rows
                else:
                    # For root_paths section: top rows + separator + sorted rows
                    if top_rows_found:
                        # Remove duplicates while preserving order
                        seen = set()
                        unique_top_rows = []
                        for row in top_rows_found:
                            if row not in seen:
                                seen.add(row)
                                unique_top_rows.append(row)
                        
                        section_lines = unique_top_rows + [SEPARATOR_LINE] + sorted_other_rows
                    else:
                        section_lines = sorted_other_rows
                
                # Reconstruct the section content, preserving original spacing before next section
                sections[i + 1] = f"{leading_ws}" + "\n".join(section_lines) + f"{trailing_ws}"
    
    # Reconstruct the file content
    new_content = ''.join(sections)
    
    # Write back to file
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(new_content)
    
    print(f"  ✓ Sorted sections in {file_path}")

def main():
    """Main function to process all .ini files in the configurations directory."""
    config_dir = Path(__file__).parent / 'configurations'
    
    if not config_dir.exists():
        print(f"Error: Configuration directory not found: {config_dir}")
        return
    
    # Find all .ini files
    ini_files = list(config_dir.glob('*.ini'))
    
    if not ini_files:
        print("No .ini files found in the configurations directory.")
        return
    
    print(f"Found {len(ini_files)} .ini files to process:")
    
    # Process each .ini file
    for ini_file in sorted(ini_files):
        try:
            sort_ini_sections(ini_file)
        except Exception as e:
            print(f"  ✗ Error processing {ini_file}: {e}")
    
    print("\nAll files processed successfully!")

if __name__ == '__main__':
    main() 