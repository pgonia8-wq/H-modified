import React, { useState, useEffect } from "react";
import HomePage from "./pages/HomePage";
import { MiniKit, VerificationLevel } from "@worldcoin/minikit-js";

const APP_ID = "app_6a98c88249208506dcd4e04b529111fc";

const App = () => {
  const [wallet, setWallet] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [verified, setVerified] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [walletLoading, setWalletLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [miniKitReady, setMiniKitReady] = useState(false);

  // Carga datos de localStorage al montar
  useEffect(() => {
    const storedId = localStorage.getItem("userId");
    if (storedId) {
      setUserId(storedId);
      setVerified(true);
      console.log("[APP] User ID cargado de localStorage:", storedId);
    } else {
      console.log("[APP] No hay userId en localStorage");
    }

    const storedWallet = localStorage.getItem("wallet");
    if (storedWallet) {
      setWallet(storedWallet);
      console.log("[APP] Wallet cargada de localStorage:", storedWallet);
    }

    const storedUsername = localStorage.getItem("username");
    if (storedUsername) {
      setUsername(storedUsername);
      console.log("[APP] Username cargado de localStorage:", storedUsername);
    }
  }, []);

  // Inicializa MiniKit
  useEffect(() => {
    console.log("[APP] Intentando inicializar MiniKit...");
    try {
      MiniKit.install({ appId: APP_ID });
      const installed = MiniKit.isInstalled();
      console.log("[APP] MiniKit.isInstalled():", installed);

      if (installed) {
        setMiniKitReady(true);
        const w = MiniKit.walletAddress;
        if (w) {
          setWallet(w);
          localStorage.setItem("wallet", w);
          console.log("[APP] Wallet detectada al inicio:", w);
        }
      } else {
        console.warn("[APP] MiniKit no instalado aún");
      }
    } catch (err) {
      console.error("[APP] Error al instalar MiniKit:", err);
      setError("MiniKit no se pudo inicializar");
    }
  }, []);

  // Carga wallet si está verificado pero wallet no cargada
  useEffect(() => {
    const loadWallet = async () => {
      if (!verified || wallet || walletLoading || !miniKitReady) return;

      setWalletLoading(true);
      console.log("[APP] Iniciando walletAuth...");

      try {
        const nonceRes = await fetch("/api/nonce");
        if (!nonceRes.ok) throw new Error("Error obteniendo nonce");

        const { nonce } = await nonceRes.json();
        console.log("[APP] Nonce recibido:", nonce);

        const authResult = await Promise.race([
          MiniKit.commandsAsync.walletAuth({
            nonce,
            requestId: "wallet-auth-" + Date.now(),
            expirationTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            notBefore: new Date(Date.now() - 24 * 60 * 60 * 1000),
            statement: "Autenticar wallet para H humans y compartir mi username público",
          }),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Timeout en walletAuth (30s)")), 30000)
          ),
        ]);

        console.log("[APP] walletAuth resultado completo:", authResult);

        if (authResult?.finalPayload?.status === "success") {
          const w = authResult.finalPayload.address;
          const u = authResult.finalPayload.username || null;

          setWallet(w);
          localStorage.setItem("wallet", w);

          if (u) {
            setUsername(u);
            localStorage.setItem("username", u);
            console.log("[APP] Username obtenido:", u);
          } else {
            console.log("[APP] No se obtuvo username (se usará fallback)");
          }

          console.log("[APP] Wallet cargada:", w);
        } else {
          throw new Error("walletAuth falló");
        }
      } catch (err: any) {
        console.error("[APP] Error en walletAuth:", err);
        setError(err.message || "Error al autenticar wallet");
      } finally {
        setWalletLoading(false);
      }
    };

    loadWallet();
  }, [verified, wallet, walletLoading, miniKitReady]);

  // Verificación World ID
  const verifyUser = async () => {
    if (verifying) return;
    if (userId) {
      console.log("[APP] Ya verificado, userId existe:", userId);
      return;
    }

    setVerifying(true);
    setError(null);
    console.log("[APP] Iniciando World ID Verify...");

    try {
      if (!MiniKit.isInstalled()) {
        throw new Error("MiniKit no está instalado. Abre la app desde World App.");
      }

      const verifyRes = await Promise.race([
        MiniKit.commandsAsync.verify({
          action: "verify-user",
          verification_level: VerificationLevel.Device, // Cambia a Orb si quieres verificación fuerte
          signal: "h-humans-login-" + Date.now(), // Anti-replay
        }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Timeout en verificación (30s)")), 30000)
        ),
      ]);

      console.log("[APP] Verify response:", verifyRes);

      const proof = verifyRes?.finalPayload;
      if (!proof || proof.status !== "success") {
        throw new Error(proof?.error || "Verificación cancelada o fallida");
      }

      // Envía proof al backend
      const res = await fetch("/api/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload: proof }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Backend error: ${res.status} - ${text}`);
      }

      const backend = await res.json();
      console.log("[APP] Backend verify response:", backend);

      if (backend.success) {
        const id = proof.nullifier_hash;
        localStorage.setItem("userId", id);
        setUserId(id);
        setVerified(true);
        console.log("[APP] Verificación exitosa! userId:", id);
      } else {
        throw new Error(backend.error || "Backend rechazó la verificación");
      }
    } catch (err: any) {
      console.error("[APP] Error en verifyUser:", err);
      setError(err.message || "Error al verificar con World ID");
    } finally {
      setVerifying(false);
    }
  };

  return (
    <>
      {walletLoading && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="text-white text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500 mx-auto mb-4"></div>
            <p>Cargando wallet...</p>
          </div>
        </div>
      )}

      {verifying && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="text-white text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500 mx-auto mb-4"></div>
            <p>Verificando identidad con World ID...</p>
          </div>
        </div>
      )}

      {(!userId || !verified) && !walletLoading && !verifying ? (
        <div className="min-h-screen flex items-center justify-center bg-black text-white">
          <p className="text-center">Cargando sesión... verifica con World ID</p>
        </div>
      ) : (
        <HomePage
          userId={userId}
          verifyUser={verifyUser}
          verified={verified}
          wallet={wallet}
          username={username}
          error={error}
          verifying={verifying}
          setUserId={setUserId}
        />
      )}
    </>
  );
};

export default App;
