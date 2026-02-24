import { useEffect, useState, useCallback } from "react";
import { MiniKit } from "@worldcoin/minikit-js";

export function useMiniKitUser() {
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [status, setStatus] = useState<
    "initializing" | "not-installed" | "no-wallet" | "found" | "error"
  >("initializing");

  const [isVerifying, setIsVerifying] = useState(false);

  // 🔎 Detectar wallet dentro de World App
  useEffect(() => {
    const init = async () => {
      if (!MiniKit.isInstalled()) {
        setStatus("not-installed");
        return;
      }

      try {
        const wallet = await MiniKit.commandsAsync.getWallet();

        console.log("Wallet RAW:", wallet);

        if (wallet?.address) {
          setWalletAddress(wallet.address);
          setStatus("found");
        } else {
          setStatus("no-wallet");
        }
      } catch (err) {
        console.error("Error obteniendo wallet:", err);
        setStatus("error");
      }
    };

    setTimeout(init, 1000);
  }, []);

  // 🔐 Verificación Orb REAL (devuelve proof completo)
  const verifyOrb = useCallback(
    async (action: string, signal: string) => {
      if (!MiniKit.isInstalled()) {
        throw new Error("MiniKit no está instalado");
      }

      setIsVerifying(true);

      try {
        const response = await MiniKit.commandsAsync.verify({
          action,
          signal,
          verification_level: "Orb",
        });

        console.log("Respuesta completa de verify:", response);

        if (!response || response.status !== "success") {
          throw new Error("Verificación cancelada o fallida");
        }

        // 🔥 Devuelve TODO el proof para enviarlo al backend
        return response;
      } finally {
        setIsVerifying(false);
      }
    },
    []
  );

  return {
    walletAddress,
    status,
    verifyOrb,
    isVerifying,
  };
    }
