// ~/projects/h/src/lib/useMiniKitUser.ts
import { useState, useEffect } from "react";
import { MiniKit, VerificationLevel } from "@worldcoin/minikit-js";

export function useMiniKitUser() {
  const [wallet, setWallet] = useState<string | null>(null);
  const [verified, setVerified] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      MiniKit.install();
      const installed = MiniKit.isInstalled();
      console.log("MiniKit installed:", installed);

      if (installed) {
        const w = MiniKit.walletAddress;
        if (w) setWallet(w);
      }
    } catch (err) {
      console.error("MiniKit install error:", err);
      setError("Error al instalar MiniKit");
    }
  }, []);

  const verifyUser = async () => {
    if (!wallet || verifying) return;

    setVerifying(true);
    setError(null);

    try {
      const verifyRes = await MiniKit.commandsAsync.verify({
        action: "verify-user",           // Acción exacta en tu portal 4.0
        signal: wallet,                   // Wallet actual
        verification_level: VerificationLevel.Device
      });

      console.log("Verify response:", verifyRes);

      const proof = verifyRes?.finalPayload;

      if (!proof) throw new Error("No se recibió proof");

      const res = await fetch("/api/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload: proof }) // ENVÍO CORRECTO 4.0
      });

      const backend = await res.json();
      console.log("Backend response:", backend);

      if (backend.success) {
        setVerified(true);
      } else {
        setError("Backend rechazó la prueba");
      }

    } catch (err: any) {
      console.error("Verify error:", err);
      setError(err.message || "Error durante verificación");
    } finally {
      setVerifying(false);
    }
  };

  return { wallet, verified, verifying, error, verifyUser };
        }
