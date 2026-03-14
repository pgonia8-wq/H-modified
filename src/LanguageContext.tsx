import React, { createContext, useContext, useState, ReactNode, useEffect } from "react";

type Language = "es" | "en";

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const translations: Record<Language, Record<string, string>> = {
  es: {
    post: "Publicar",
    cancel: "Cancelar",
    notifications: "Notificaciones",
    messages: "Mensajes",
    write_something: "¿Qué está pasando?",
    // agrega todas las llaves que uses en tu app
  },
  en: {
    post: "Post",
    cancel: "Cancel",
    notifications: "Notifications",
    messages: "Messages",
    write_something: "What's happening?",
  },
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [language, setLanguage] = useState<Language>("es");

  // Persistir idioma en sessionStorage
  useEffect(() => {
    const saved = sessionStorage.getItem("language") as Language | null;
    if (saved) setLanguage(saved);
  }, []);

  const changeLanguage = (lang: Language) => {
    setLanguage(lang);
    sessionStorage.setItem("language", lang);
  };

  const t = (key: string) => translations[language][key] || key;

  return (
    <LanguageContext.Provider value={{ language, setLanguage: changeLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLanguage must be used within LanguageProvider");
  return context;
};
