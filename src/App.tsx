import React, { useEffect, useState } from "react";
import FeedPage from "./pages/FeedPage";
import { useMiniKitUser } from "./lib/useMiniKitUser";
import { MiniKit } from "@worldcoin/minikit-js";

const App: React.FC = () => {
  const { walletAddress, status, verifyOrb, proof, isVerifying } = useMiniKitUser();
  const [verified, setVerified] = useState(false);
  const [verifying, setVerifying] = useState(false);

  // Debug de estado y MiniKit
  useEffect(() => {
    console.log("🚀 App mounted");
    console.log("MiniKit.isInstalled():", MiniKit.isInstalled());
    console.log("Initial status:", status);
    console.log("Initial walletAddress:", walletAddress);
  }, []);

  // Verificación cada 3s solo si MiniKit está listo
  useEffect(() => {
    const interval = setInterval(async () => {
      console.log("⏱ Interval check - status:", status, "walletAddress:", walletAddress);

      if (!MiniKit.isInstalled()) {
        console.warn("❌ MiniKit no está instalado. Solo funciona dentro de World App.");
        return;
      }

      if (!walletAddress) {
        console.warn("⚠️ walletAddress no disponible aún.");
        return;
      }

      if (verified) return;

      setVerifying(true);
      try {
        console.log("🔹 Ejecutando verifyOrb...");
        const orbProof = await verifyOrb("verify_user", walletAddress);
        console.log("✅ orbProof recibido:", orbProof);

        // Llamada al backend
        const res = await fetch("/api/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            payload: orbProof,
            action: "verify_user",
            signal: walletAddress,
          }),
        });

        const result = await res.json();
        console.log("📡 RPC response:", result);

        if (result.success) {
          console.log("🎉 Usuario verificado correctamente");
          setVerified(true);
        } else {
          console.error("❌ Proof inválido o backend rechazó:", result.error);
        }
      } catch (err) {
        console.error("⚠️ Error durante la verificación:", err);
      } finally {
        setVerifying(false);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [status, walletAddress, verifyOrb, verified]);

  // Renderizado según estado
  if (status === "initializing" || status === "polling" || isVerifying) {
    return (
      <div className="w-screen h-screen flex items-center justify-center bg-black text-white">
        Cargando World ID...
      </div>
    );
  }

  if (!MiniKit.isInstalled() || !walletAddress || status === "not-installed" || status === "timeout") {
    return (
      <div className="w-screen h-screen flex items-center justify-center bg-black text-white text-center p-6">
        Esta aplicación solo funciona dentro de World App y con World ID verificado.
      </div>
    );
  }

  if (!verified) {
    return (
      <div className="w-screen h-screen flex items-center justify-center bg-black text-white text-center p-6">
        Verificando World ID...
      </div>
    );
  }

  return (
    <div className="w-screen h-screen bg-black text-white flex flex-col">
      <header className="p-4 text-xl font-bold text-center">Human Feed</header>
      <main className="flex-1 overflow-auto p-4">
        <FeedPage wallet={walletAddress} />
      </main>
    </div>
  );
};

export default App;
