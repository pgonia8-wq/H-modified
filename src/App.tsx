import React, { useState, useEffect } from "react";
import HomePage from "./pages/HomePage";
import { MiniKit, VerificationLevel } from "@worldcoin/minikit-js";

const App = () => {
  const [wallet, setWallet] = useState<string | null>(null);
  const [verified, setVerified] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [walletLoading, setWalletLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  // Carga ID de localStorage
  useEffect(() => {
    const storedId = localStorage.getItem("userId");

    if (storedId) {
      setUserId(storedId);
      setVerified(true);
      console.log("[APP] ID cargado de localStorage:", storedId);
    } else {
      console.log("[APP] No hay ID en localStorage");
    }
  }, []);

  // Inicializa MiniKit
  useEffect(() => {
    console.log("[APP] Intentando instalar MiniKit...");

    try {
      MiniKit.install({
        appId: "app_6a98c88249208506dcd4e04b529111fc",
      });

      const installed = MiniKit.isInstalled();

      console.log("[APP] MiniKit.isInstalled():", installed);

      if (!installed) {
        console.warn("[APP] MiniKit no instalado aún");
        return;
      }

      const w = MiniKit.walletAddress;

      if (w) {
        setWallet(w);
        console.log("[APP] Wallet detectada al inicio:", w);
      } else {
        console.log("[APP] Wallet aún no disponible (normal)");
      }

    } catch (err) {
      console.error("[APP] MiniKit install error:", err);
      setError("Error al instalar MiniKit");
    }
  }, []);

  // Autenticación de wallet (solo si verificado)
  useEffect(() => {

    const loadWallet = async () => {

      if (!verified) return;
      if (wallet) return;
      if (walletLoading) return;

      setWalletLoading(true);

      console.log("[APP] Wallet undefined → iniciando walletAuth...");

      try {

        const nonceRes = await fetch("/api/nonce");

        if (!nonceRes.ok) {
          const text = await nonceRes.text();
          throw new Error(`Nonce fetch failed: ${nonceRes.status} - ${text}`);
        }

        const { nonce } = await nonceRes.json();

        console.log("[APP] Nonce recibido:", nonce);

        const authResult = await MiniKit.commandsAsync.walletAuth({
          nonce,
          requestId: "wallet-auth-" + Date.now(),
          expirationTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          notBefore: new Date(Date.now() - 24 * 60 * 60 * 1000),
          statement: "Autenticar wallet para H humans",
        });

        console.log("[APP] walletAuth resultado completo:", authResult);

        if (authResult?.finalPayload?.status === "success") {

          const walletAddress =
            authResult.finalPayload.address ||
            authResult.finalPayload.wallet_address ||
            null;

          if (!walletAddress) {
            throw new Error("walletAuth no devolvió address");
          }

          setWallet(walletAddress);

          console.log("[APP] Wallet cargada desde finalPayload:", walletAddress);

        } else {
          throw new Error("walletAuth cancelado o fallido");
        }

      } catch (err: any) {

        console.error("[APP] Error completo en walletAuth:", err);

        setError(
          "No se pudo autenticar la wallet: " +
            (err?.message || "Error desconocido")
        );

      } finally {
        setWalletLoading(false);
      }
    };

    loadWallet();

  }, [verified]);

  const verifyUser = async () => {

    if (verifying) return;

    if (userId) {
      console.log("[APP] Ya hay userId guardado, no es necesario verificar");
      return;
    }

    setVerifying(true);
    setError(null);

    console.log("[APP] Iniciando verificación...");

    try {

      if (!MiniKit.isInstalled()) {
        throw new Error("MiniKit no instalado");
      }

      const verifyRes = await MiniKit.commandsAsync.verify({
        action: "verify-user",
        verification_level: VerificationLevel.Device,
      });

      console.log("[APP] Verify response:", verifyRes);

      const proof = verifyRes?.finalPayload;

      if (!proof || proof.status !== "success") {
        throw new Error("Verificación fallida o cancelada");
      }

      const res = await fetch("/api/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ payload: proof }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Backend error: ${res.status} - ${text}`);
      }

      const backend = await res.json();

      console.log("[APP] Backend response:", backend);

      if (backend.success) {

        const id = proof.nullifier_hash;

        localStorage.setItem("userId", id);

        setUserId(id);
        setVerified(true);

        console.log("[APP] Verificación exitosa, userId guardado:", id);

      } else {

        setError(
          "Backend rechazó la prueba: " +
            (backend.error || "Desconocido")
        );

      }

    } catch (err: any) {

      console.error("[APP] Verify error:", err);

      setError(err.message || "Error durante verificación");

    } finally {
      setVerifying(false);
    }
  };

  return (
    <HomePage
      userId={userId}
      verifyUser={verifyUser}
      verified={verified}
      wallet={wallet}
      error={error}
      verifying={verifying}
      setUserId={setUserId}
    />
  );
};

export default App;
