import { ChakraProvider } from "@chakra-ui/react";
import * as Sentry from "@sentry/react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import "./App.css";
import Connect from "./pages/connect";
import Error from "./pages/error";
import Success from "./pages/success";
import theme from "./Theme";

// https://docs.sentry.io/platforms/javascript/guides/react/configuration/integrations/react-router/#usage-with-react-router-64-data-api
const SentryRoutes = Sentry.withSentryReactRouterV6Routing(Routes);

function App() {
  return (
    <main>
      <BrowserRouter>
        <ChakraProvider theme={theme}>
          <SentryRoutes>
            <Route path="/" element={<Connect></Connect>} />
            <Route path="/success" element={<Success></Success>} />
            <Route path="/error" element={<Error></Error>} />
          </SentryRoutes>
        </ChakraProvider>
      </BrowserRouter>
    </main>
  );
}

export default App;
