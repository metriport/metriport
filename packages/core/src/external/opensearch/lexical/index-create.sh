# That's not to actually be used directly, but via OS' console or Postman.

# Create index
# Update properties with _
curl -XPUT "/consolidated-data-2" -H 'Content-Type: application/json' -d'
{
  "mappings": {
    "properties": {
      "cxId": {
        "type": "keyword"
      },
      "patientId": {
        "type": "keyword"
      },
      "resourceType": {
        "type": "keyword"
      },
      "resourceId": {
        "type": "keyword"
      },
      "content": {
        "type": "text"
      },
      "rawContent": {
        "type": "text"
      },
      "ingestionDate": {
        "type": "date"
      }
    }
  },
  "settings": {
    "number_of_shards": _,
    "number_of_replicas": 1
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
        "index": "consolidated-data-2",
        "alias": "consolidated-data",
        "is_write_index": true
      }
    }
  ]
}'
