import * as Sentry from "@sentry/react";
import { BrowserTracing } from "@sentry/tracing";
import React from "react";
import ReactDOM from "react-dom/client";
import {
  createRoutesFromChildren,
  matchRoutes,
  useLocation,
  useNavigationType,
} from "react-router-dom";
import App from "./App";
import "./index.css";
import reportWebVitals from "./reportWebVitals";
import { getEnvType, getEnvVar, getEnvVarOrFail } from "./shared/util";

Sentry.init({
  dsn: getEnvVarOrFail("REACT_APP_SENTRY_DSN"),
  release: getEnvVar("REACT_APP_GIT_SHA"),
  environment: getEnvType(),
  integrations: [
    new BrowserTracing({
      routingInstrumentation: Sentry.reactRouterV6Instrumentation(
        React.useEffect,
        useLocation,
        useNavigationType,
        createRoutesFromChildren,
        matchRoutes
      ),
    }),
    new Sentry.Replay(),
  ],
  // TODO #156 Add a ticket to review these periodically
  tracesSampleRate: 1.0,
  // This sets the sample rate to be 10%. You may want this to be 100% while
  // in development and sample at a lower rate in production
  replaysSessionSampleRate: 0.5,
  // If the entire session is not sampled, use the below sample rate to sample
  // sessions when an error occurs.
  replaysOnErrorSampleRate: 1.0,
});

const root = ReactDOM.createRoot(document.getElementById("root") as HTMLElement);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
