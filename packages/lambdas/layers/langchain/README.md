These are needed because LangChain requires Node18 features, but our lambda that uses it is still on Node16.

- node-fetch
- web-streams-polyfill
- core-js

See: https://js.langchain.com/docs/how_to/installation/#unsupported-nodejs-16
