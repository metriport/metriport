# That's not to actually be used directly, but via OS' console or Postman.

# Create index
# Update properties with _
curl -XPUT "/ccda-files-1" -H 'Content-Type: application/json' -d'
{
  "mappings": {
    "properties": {
      "cxId": {
        "type": "keyword"
      },
      "patientId": {
        "type": "keyword"
      },
      "s3FileName": {
        "type": "keyword"
      },
      "content": {
        "type": "text"
      },
    }
  },
  "settings": {
    "number_of_shards": _,
    "number_of_replicas": _
  }
}'

# Create an alias that we'll use to hit the index
# This allows us to re-create the index to make changes to it, like adding shards
# with no downtime
curl -XPOST "/_aliases" -H 'Content-Type: application/json' -d'
{
  "actions": [
    {
      "add": {
        "index": "ccda-files-1",
        "alias": "ccda-files"
      }
    }
  ]
}'