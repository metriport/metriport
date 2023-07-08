exports.handler = async event => {
  console.log(event);
  const response = {
    statusCode: 301,
    headers: {
      Location: "https://S3_URL",
    },
  };

  return response;
};
