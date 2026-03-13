import React, { createContext, useState, useContext, ReactNode, useEffect } from "react";

type ThemeType = "light" | "dark";

interface ThemeContextType {
  theme: ThemeType;
  accentColor: string;
  toggleTheme: () => void;
  setTheme: (t: ThemeType) => void;
  setAccentColor: (c: string) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  // Leer tema del localStorage al iniciar, por defecto dark
  const [theme, setTheme] = useState<ThemeType>(
    (typeof window !== "undefined" && localStorage.getItem("theme") as ThemeType) || "dark"
  );

  const [accentColor, setAccentColor] = useState<string>(
    (typeof window !== "undefined" && localStorage.getItem("accentColor")) || "#7c3aed"
  );

  // Persistir cambios en localStorage
  useEffect(() => {
    localStorage.setItem("theme", theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem("accentColor", accentColor);
  }, [accentColor]);

  const toggleTheme = () => {
    setTheme(prev => prev === "dark" ? "light" : "dark");
  };

  return (
    <ThemeContext.Provider value={{ theme, accentColor, toggleTheme, setTheme, setAccentColor }}>
      <div
        className={theme === "dark" ? "dark" : ""}
        style={{ "--accent-color": accentColor } as React.CSSProperties}
      >
        {children}
      </div>
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
};

export { ThemeContext };
