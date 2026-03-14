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

  // ================================
  // Cargar sesión guardada
  // ================================
  useEffect(() => {
    const storedId = localStorage.getItem("userId");
    const storedWallet = localStorage.getItem("wallet");
    const storedUsername = localStorage.getItem("username");

    if (storedId) {
      setUserId(storedId);
      setVerified(true);
      console.log("[APP] User ID cargado:", storedId);
    }

    if (storedWallet) {
      setWallet(storedWallet);
      console.log("[APP] Wallet cargada:", storedWallet);
    }

    if (storedUsername) {
      setUsername(storedUsername);
      console.log("[APP] Username cargado:", storedUsername);
    }
  }, []);

  // ================================
  // Inicializar MiniKit
  // ================================
  useEffect(() => {
    console.log("[APP] Inicializando MiniKit...");

    try {
      MiniKit.install({ appId: APP_ID });

      const installed = MiniKit.isInstalled();
      console.log("[APP] MiniKit instalado:", installed);

      if (installed) {
        setMiniKitReady(true);

        const w = MiniKit.walletAddress;
        if (w) {
          setWallet(w);
          localStorage.setItem("wallet", w);
          console.log("[APP] Wallet detectada:", w);
        }

        const u = MiniKit.user?.username || null;
        if (u) {
          setUsername(u);
          localStorage.setItem("username", u);
          console.log("[APP] Username detectado:", u);
        }
      }
    } catch (err) {
      console.error("[APP] Error MiniKit:", err);
      setError("Error inicializando MiniKit");
    }
  }, []);

  // ================================
  // Forzar verify si no hay sesión
  // ================================
  useEffect(() => {
    if (miniKitReady && !userId && !verifying) {
      console.log("[APP] No hay sesión → iniciando verifyUser");
      verifyUser();
    }
  }, [miniKitReady]);

  // ================================
  // Wallet Auth
  // ================================
  useEffect(() => {
    const loadWallet = async () => {
      if (!verified || wallet || walletLoading || !miniKitReady) return;

      setWalletLoading(true);
      console.log("[APP] Iniciando walletAuth...");

      try {
        const nonceRes = await fetch("/api/nonce");
        const { nonce } = await nonceRes.json();

        const authResult = await MiniKit.commandsAsync.walletAuth({
          nonce,
          requestId: "wallet-auth-" + Date.now(),
          expirationTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          notBefore: new Date(Date.now() - 24 * 60 * 60 * 1000),
          statement: "Autenticando wallet",
        });

        console.log("[APP] walletAuth resultado:", authResult);

        if (authResult?.finalPayload?.status === "success") {
          const w = authResult.finalPayload.address;
          const u = authResult.finalPayload.username || null;

          setWallet(w);
          localStorage.setItem("wallet", w);

          if (u) {
            setUsername(u);
            localStorage.setItem("username", u);
          }
        }
      } catch (err: any) {
        console.error("[APP] walletAuth error:", err);
        setError(err.message);
      } finally {
        setWalletLoading(false);
      }
    };

    loadWallet();
  }, [verified, wallet, walletLoading, miniKitReady]);

  // ================================
  // Verificación World ID
  // ================================
  const verifyUser = async () => {
    if (verifying) return;

    setVerifying(true);
    setError(null);

    console.log("[APP] Iniciando verificación World ID");

    try {
      const verifyRes = await MiniKit.commandsAsync.verify({
        action: "verify-user",
        verification_level: VerificationLevel.Device,
        signal: "verify-" + Date.now(),
      });

      console.log("[APP] Verify result:", verifyRes);

      const proof = verifyRes?.finalPayload;

      if (!proof || proof.status !== "success") {
        throw new Error("Verificación fallida");
      }

      const res = await fetch("/api/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload: proof }),
      });

      const backend = await res.json();

      console.log("[APP] Backend response:", backend);

      if (backend.success) {
        const id = proof.nullifier_hash;

        localStorage.setItem("userId", id);

        setUserId(id);
        setVerified(true);

        if (backend.profile?.username) {
          setUsername(backend.profile.username);
          localStorage.setItem("username", backend.profile.username);
        }

        console.log("[APP] Usuario verificado:", id);
      } else {
        throw new Error(backend.error);
      }
    } catch (err: any) {
      console.error("[APP] Error verify:", err);
      setError(err.message);
    } finally {
      setVerifying(false);
    }
  };

  // ================================
  // UI
  // ================================
  return (
    <>
      {(walletLoading || verifying) && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="text-white text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500 mx-auto mb-4"></div>
            <p>
              {verifying
                ? "Verificando identidad con World ID..."
                : "Cargando wallet..."}
            </p>
          </div>
        </div>
      )}

      {!userId && !verifying ? (
        <div className="min-h-screen flex items-center justify-center bg-black text-white">
          <p>Cargando sesión...</p>
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
