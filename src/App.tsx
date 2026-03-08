import React, { useEffect, useState, useContext } from "react";
import { MiniKit, VerificationLevel } from "@worldcoin/minikit-js";
import { ThemeContext } from "../lib/ThemeContext";
import HomePage from "./HomePage";

const App = () => {
  const [userId, setUserId] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { theme } = useContext(ThemeContext);

  useEffect(() => {
    // Si ya está en localStorage, usarlo directo
    const stored = localStorage.getItem("userId");
    if (stored) {
      setUserId(stored);
      console.log("[APP] userId desde localStorage:", stored);
    }
  }, []);

  const verifyUser = async () => {
    if (verifying) return;
    setVerifying(true);
    setError(null);

    try {
      // Instalar MiniKit si aún no
      MiniKit.install();
      const installed = MiniKit.isInstalled();
      console.log("[APP] MiniKit installed:", installed);
      if (!installed) throw new Error("MiniKit no está instalado");

      // Ejecutar verificación
      const verifyRes = await MiniKit.commandsAsync.verify({
        action: "verify-user",                     // Requerido por docs
        verification_level: VerificationLevel.Device,
      });

      console.log("[APP] verifyRes:", verifyRes);

      if (!verifyRes || !verifyRes.finalPayload) {
        throw new Error("No se recibió finalPayload de MiniKit");
      }

      // Enviar al backend todo el payload
      const res = await fetch("/api/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payload: verifyRes.finalPayload,
          action: "verify-user",
        }),
      });

      const data = await res.json();
      console.log("[APP] Backend verify response:", data);

      if (!data.success || !data.userId) {
        throw new Error("Backend rechazó la verificación");
      }

      // Guardar userId confirmado en localStorage y estado
      localStorage.setItem("userId", data.userId);
      setUserId(data.userId);
      console.log("[APP] userId guardado:", data.userId);

    } catch (err: any) {
      console.error("[APP] Error verifyUser:", err);
      setError(err.message || "Error durante verificación");
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className={`min-h-screen ${theme === "dark" ? "bg-black text-white" : "bg-white text-black"}`}>
      {/* Botón de verificación, solo si no hay userId */}
      {!userId && (
        <div className="p-4">
          <button
            onClick={verifyUser}
            disabled={verifying}
            className="px-6 py-3 bg-purple-600 rounded-full text-white font-semibold"
          >
            {verifying ? "Verificando..." : "Verificar World ID"}
          </button>
          {error && <p className="text-red-500 mt-2">{error}</p>}
        </div>
      )}

      {/* HomePage con userId confirmado */}
      {userId && <HomePage userId={userId} />}
    </div>
  );
};

export default App;
