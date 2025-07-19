import json
import sys
import csv
import configparser
import logging
import os
from datetime import datetime

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s: %(levelname)s - %(message)s'
)


def extract_paths(json_obj, current_path='', all_paths=None, ignore_paths=None):
    if all_paths is None:
        all_paths = set()
    if ignore_paths is None:
        ignore_paths = set()

    if isinstance(json_obj, dict):
        for k, v in json_obj.items():
            new_path = f"{current_path}.{k}" if current_path else k
            if new_path not in ignore_paths:
                extract_paths(v, new_path, all_paths, ignore_paths)
    elif isinstance(json_obj, list):
        for idx, item in enumerate(json_obj):
            extract_paths(item, f"{current_path}.{idx}", all_paths, ignore_paths)
    else:
        if current_path != '':
            all_paths.add(current_path)
    return all_paths



def compare_and_write_new_paths(json_obj, filename, anchor, config_paths, output_file):
    new_paths = set()
    all_paths = set()


    if config_paths.has_section('ignore_paths'):
        ignore_path_set = set(config_paths['ignore_paths'].values())
    else:
        ignore_path_set = None

    if anchor:
        anchor_obj = get_sub_object(json_obj, anchor)

        if isinstance(anchor_obj, list):
            for item in anchor_obj:
                item_paths = extract_paths(item, ignore_paths=ignore_path_set)
                all_paths.update(item_paths)
        else:
            all_paths = extract_paths(anchor_obj, ignore_paths=ignore_path_set)
        new_paths = all_paths - {path[len("Anchor:"):] if path.startswith("Anchor:") else path for path in config_paths['anchor_paths'].values()}
    else:
        all_paths = extract_paths(json_obj, ignore_paths=ignore_path_set)
        new_paths = all_paths - set(config_paths['root_paths'].values())



    if new_paths:
        os.makedirs(os.path.dirname(output_file), exist_ok=True)
        with open(output_file, 'a') as file:

            for path in new_paths:
                if anchor:
                    file.write(f'"{filename.name}","Anchor:{path}","{anchor}"\n')
                else:
                    file.write(f'"{filename.name}","{path}",""\n')


def get_sub_object(obj, path):
    for part in path.split('.'):
        if part.isdigit():
            part = int(part)  # Convert to integer for list indices
        try:
            obj = obj[part]
        except (TypeError, KeyError, IndexError):
            # Handle the case where the path does not exist in the object
            return None
    return obj


def is_integer(n):
    try:
        float(n)
    except ValueError:
        return False
    else:
        return float(n).is_integer()


def getJsonValue(lnjsn, ln,filename = ""):
    retVal = ""
    for x in ln.split("."):
        if x.startswith("ArrJoin:"):
            x = x[8:]
            if x in lnjsn:
                tempVal = ' '.join([str(item) for item in lnjsn[x]])
                lnjsn = tempVal
            else:
                lnjsn = ""
        elif x.startswith("Filename:"):
            lnjsn = filename
        elif x.startswith("GetDate:"):
            lnjsn = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        elif x.startswith("ArrNotHave:"):
            x = x[11:]
            found = False
            for i in range(len(lnjsn)):
                if getJsonValue(lnjsn[i], x.replace(",","."),filename) is None:
                    lnjsn = lnjsn[i]
                    found = True
                    break
            if found != True:
                return None
        elif x.startswith("ArrCond:"):
            spl = x[8:].split("|")
            found = False
            for i in range(len(lnjsn)):
                if getJsonValue(lnjsn[i], spl[0].replace(",",".")
                                ,filename) == spl[1].replace(",","."):
                    lnjsn = lnjsn[i]
                    found = True
                    break
            if found != True:
                return None
        elif x.startswith("Hard:"):
            lnjsn = x[5:]
        elif x.startswith("IfEx:"):
            spl = x[5:].split("|")
            if spl[0] in lnjsn:
                lnjsn = spl[1]
            else:
                lnjsn = spl[2]
        elif x.startswith("IfEq:"):
            spl = x[5:].split("|")
            if lnjsn[spl[0]] == spl[1].replace(",","."):
                lnjsn = spl[2]
            else:
                lnjsn = spl[3]
        elif x.startswith("Left:"):
            spl = x[5:].split("|")
            if spl[0] in lnjsn:
                lnjsn = lnjsn[spl[0]]
                lnjsn = lnjsn[:int(spl[1])]
            else:
                return None
        elif x.startswith("LTrim:"):
            spl = x[6:].split("|")
            if spl[0] in lnjsn:
                lnjsn = lnjsn[spl[0]]
                lnjsn = lnjsn[int(spl[1]):]
            else:
                return None
        elif x.startswith("TimeForm:"):
            x = x[9:]
            if x in lnjsn:
                lnjsn = lnjsn[x]
                lnjsn = lnjsn[:19].replace("T"," ")
            else:
                return None
        elif x in lnjsn and not isinstance(lnjsn,str):
            lnjsn = lnjsn[x]
        elif is_integer(x):
            if isinstance(lnjsn, list) and int(x) < len(lnjsn):
                lnjsn = lnjsn[int(x)]
            else:
                lnjsn = ""
                break
        else:
            return None
    return lnjsn


def combineValues(jsn, path, filename):
    values = []
    for ln in path.splitlines():
        value = getJsonValue(jsn, ln, filename)
        if value is not None and value != '':  # This will skip over both None and empty strings, preserves 0 and False
            values.append(str(value))

    retVal = " ".join(values).strip()

    return retVal if retVal else None







####### Main #######
def writerow_flex(data,csvwriter,row,outputFormat):
    if outputFormat =='csv':
        csvwriter.writerow(row)
    elif outputFormat == 'parquet' or outputFormat == 'return':
        data.append(row)

def parse_one_resource(anchor,paths,jsndict,leng,csvwriter,data,filename,outputFormat):
    thisRow = [None]*leng
    result_count = 0
    if anchor == False:
        for i in range(leng):
            thisRow[i] = combineValues(jsndict, paths[i],filename)
        writerow_flex(data,csvwriter,thisRow,outputFormat)
        return 1
    else:
        anchorArray = getJsonValue(jsndict, anchor, filename)
        if anchorArray is not None and isinstance(anchorArray, list):
            for z in anchorArray:
                thisRow = [None] * leng
                for i in range(leng):
                    if paths[i][:7] == 'Anchor:':
                        thisRow[i] = combineValues(z, paths[i][7:],filename)
                    else:
                        thisRow[i] = combineValues(jsndict, paths[i],filename)
                result_count += 1
                writerow_flex(data, csvwriter, thisRow, outputFormat)
            return result_count
        elif anchorArray is not None:
            for i in range(leng):
                if paths[i][:7] == 'Anchor:':
                    thisRow[i] = combineValues(anchorArray,
                                               paths[i][7:]
                                               , filename)
                else:
                    thisRow[i] = combineValues(jsndict, paths[i], filename)

            writerow_flex(data, csvwriter, thisRow, outputFormat)
            return 1


def parse(configPath,inputPath=None,outputPath=None,missingPath=None,outputFormat=None,inputFormat=None,writeMode=None):
    f = open(configPath, "r")
    logging.info('Started parsing "%s"', configPath)

    config = configparser.ConfigParser()
    try:
        config.read(configPath)
    except:
        logging.exception(f"Failed to read or parse the configuration file: {configPath}. Error: {e}")
        return



    anchor = config['GenConfig'].get('anchor', False)
    inputPath = inputPath or config['GenConfig']['inputPath']
    outputPath = outputPath or config['GenConfig']['outputPath']
    missingPath = missingPath or config['GenConfig'].get('missingPath',None)
    outputFormat = outputFormat or config['GenConfig'].get('outputFormat', 'return')
    inputFormat = inputFormat or config['GenConfig'].get('inputFormat', 'json')

    if (writeMode or config['GenConfig'].get('writeMode', 'a')).lower() in ['w','write']:
        writeMode = "w"
    else:
        writeMode = "a"

    if inputFormat == 'ndjson' and outputFormat != 'csv':
        raise ValueError("Input format 'ndjson' is only supported with 'csv' output format.")
    
    data = []
    header = []
    paths = []
    leng = 0
    row_count = 0

    for key in config['Struct']:
        header.append(key)
        paths.append(config['Struct'][key])
        leng = leng + 1

    if outputFormat == 'csv':
        csvfile = open(outputPath, writeMode, newline='')
        csvwriter = csv.writer(csvfile,
                               delimiter=',',
                               escapechar='\\',
                               quoting=csv.QUOTE_ALL
                               )
        if writeMode == "w":
            csvwriter.writerow(header)
    else:
        csvfile = None
        csvwriter = None



    if inputFormat == 'ndjson':
        with open(inputPath, encoding='utf-8-sig') as inputFile:
            for jsntxt in inputFile:
                result_count = 0
                try:
                    jsndict = json.loads(jsntxt)
                    result_count = parse_one_resource(anchor, paths, jsndict, leng, csvwriter,data,inputPath,outputFormat)
                    if missingPath:
                        compare_and_write_new_paths(jsndict,inputFile,anchor,config,missingPath)
                except:

                    logging.exception('Issue with input file "%s", see badfile.csv',
                                      configPath
                                      )
                row_count = row_count + (result_count or 0)
    elif inputFormat == 'json':
        with open(inputPath, encoding='utf-8-sig') as inputFile:
            result_count = 0
            try:
                jsndict = json.loads(inputFile.read())
                result_count = parse_one_resource(anchor, paths, jsndict, leng, csvwriter,data,inputPath,outputFormat)
                if missingPath:
                    compare_and_write_new_paths(jsndict,inputFile,anchor,config,missingPath)
            except:
                logging.exception('Issue with input file "%s" ',
                                  configPath
                                  )


            row_count = row_count + (result_count or 0)
    if outputFormat == 'csv':
        csvfile.close()

    elif outputFormat == 'parquet':
        try:
            import pyarrow as pa
            import pyarrow.parquet as pq
            import pandas as pd
        except ImportError:
            raise ImportError("Please install pyarrow and pandas to use the 'parquet' output format.")
        table = pa.Table.from_pandas(pd.DataFrame(data, columns=header))
        pq.write_table(table, outputPath)
    elif outputFormat == 'return':
        try:
            import pandas as pd
        except ImportError:
            raise ImportError("Please install pandas to use the 'return' output format.")

        return pd.DataFrame(data, columns=header)
    logging.info('Finished parsing "%s", %s rows written',
                 configPath,
                 str(row_count)
                 )
