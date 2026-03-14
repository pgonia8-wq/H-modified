import React, { createContext, useState, useContext, ReactNode } from "react";

type Language = "es" | "en";

interface Translations {
  [key: string]: string;
}

interface LanguageContextProps {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const translations: Record<Language, Translations> = {
  es: {
    post: "Post",
    create_post: "Crear post",
    whats_happening: "¿Qué está pasando?",
    cancel: "Cancelar",
    publish: "Publicar",
    messages: "Mensajes",
    write_a_message: "Escribe un mensaje...",
    attachments: "Adjuntos",
    notifications: "Notificaciones",
    no_notifications: "Aún no tienes notificaciones.",
    write_before_posting: "Escribe algo antes de publicar",
  },
  en: {
    post: "Post",
    create_post: "Create Post",
    whats_happening: "What's happening?",
    cancel: "Cancel",
    publish: "Publish",
    messages: "Messages",
    write_a_message: "Write a message...",
    attachments: "Attachments",
    notifications: "Notifications",
    no_notifications: "You have no notifications yet.",
    write_before_posting: "Write something before posting",
  },
};

const LanguageContext = createContext<LanguageContextProps>({
  language: "es",
  setLanguage: () => {},
  t: (key: string) => key,
});

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [language, setLanguage] = useState<Language>("es");

  const t = (key: string) => {
    return translations[language][key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => useContext(LanguageContext);
export { LanguageContext };
