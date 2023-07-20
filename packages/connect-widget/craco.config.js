// https://github.com/facebook/create-react-app/issues/11889#issuecomment-1114928008

module.exports = {
  webpack: {
    configure: {
      resolve: {
        fallback: {
          https: false,
          stream: false,
          crypto: false,
        },
      },
    },
  },
};
