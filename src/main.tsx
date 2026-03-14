import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

import { MiniKitProvider } from "@worldcoin/minikit-js/minikit-provider";
import { ThemeProvider } from "./lib/ThemeContext";
import { UserProvider } from "./context/UserContext";
import { LanguageProvider } from "./LanguageContext";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <MiniKitProvider appId="app_6a98c88249208506dcd4e04b529111fc">
    <UserProvider>
      <ThemeProvider>
        <LanguageProvider>
          <App />
        </LanguageProvider>
      </ThemeProvider>
    </UserProvider>
  </MiniKitProvider>
);
