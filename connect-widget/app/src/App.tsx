import "./App.css";
import { ChakraProvider} from "@chakra-ui/react";
import theme from "./Theme";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import Connect from "./components/connect/connect";
import Success from "./components/success/success";
import Error from "./components/error/error";

function App() {
  return (
    <main>
      <BrowserRouter>
        <ChakraProvider theme={theme}>
          <Routes>
            <Route path="/" element={<Connect></Connect>} />
            <Route path="/success" element={<Success></Success>} />
            <Route path="/error" element={<Error></Error>} />
          </Routes>
        </ChakraProvider>
      </BrowserRouter>
    </main>
  );
}

export default App;
