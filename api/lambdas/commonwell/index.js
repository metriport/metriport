exports.handler = async event => {
  console.log(event);
  const response = {
    statusCode: 301,
    headers: {
      Location: "https://tmp-407.s3.us-east-2.amazonaws.com/doc-contrib-payload",
    },
  };

  return response;
};
