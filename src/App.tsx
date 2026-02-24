import React, { useEffect, useState } from "react";
import FeedPage from "./pages/FeedPage";
import { useMiniKitUser } from "./lib/useMiniKitUser";
import { MiniKit } from "@worldcoin/minikit-js";

const App: React.FC = () => {
  const { walletAddress, status, verifyOrb, proof, isVerifying } = useMiniKitUser();
  const [verified, setVerified] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [retryCount, setRetryCount] = useState(() => {
    const saved = localStorage.getItem('retryCount');
    return saved ? parseInt(saved, 10) : 0;
  });
  const [isRetrying, setIsRetrying] = useState(false);

  // Guardar contador en localStorage
  useEffect(() => {
    localStorage.setItem('retryCount', retryCount.toString());
  }, [retryCount]);

  // Logs de debug
  useEffect(() => {
    console.log('🔍 MiniKit.isInstalled:', MiniKit.isInstalled?.() ?? 'no disponible');
    console.log('🔍 Status:', status ?? 'sin-status');
    console.log('🔍 Wallet:', walletAddress ?? 'sin-wallet');
    console.log('🔍 isVerifying:', isVerifying);
    console.log('🔍 verified:', verified);
    console.log('🔍 Intentos totales:', retryCount);
  }, [status, walletAddress, isVerifying, verified, retryCount]);

  // AUTO-RETRY cada 6 segundos si está atascado
  useEffect(() => {
    if (status === "initializing" || status === "polling" || status === "error") {
      const interval = setInterval(() => {
        setRetryCount(c => c + 1);
        window.location.reload(); // reload completo para forzar nuevo polling
        console.log('Auto-reload por stuck - intento:', retryCount + 1);
      }, 6000);

      return () => clearInterval(interval);
    }
  }, [status, retryCount]);

  // Verificación cuando llegue a "found"
  useEffect(() => {
    if (status !== "found" || !walletAddress || verified) return;

    const doVerify = async () => {
      setVerifying(true);
      try {
        console.log("Iniciando verificación");
        const orbProof = await verifyOrb("verify_user", walletAddress);

        const res = await fetch("/api/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            payload: orbProof,
            action: "verify_user",
            signal: walletAddress,
          }),
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const result = await res.json();
        if (result.success) {
          setVerified(true);
        } else {
          console.error("Backend rechazó:", result);
        }
      } catch (err) {
        console.error("Error verificación:", err);
      } finally {
        setVerifying(false);
      }
    };

    doVerify();
  }, [status, walletAddress, verified, verifyOrb]);

  // Pantalla de carga
  if (!status || status === "initializing" || status === "polling" || isVerifying || verifying) {
    return (
      <div className="w-screen h-screen flex items-center justify-center bg-black text-white text-center p-6">
        Cargando World ID...<br />
        Status: {status || 'esperando'}<br />
        Intentos: {retryCount}
      </div>
    );
  }

  // Pantalla de error / no detectado
  if (!walletAddress || status === "not-installed" || status === "timeout" || status === "error") {
    return (
      <div className="w-screen h-screen flex flex-col items-center justify-center bg-black text-white text-center p-6 gap-6">
        <div className="text-xl font-bold">
          Esta aplicación solo funciona dentro de World App<br />
          y con World ID verificado.
        </div>
        <div className="text-sm text-gray-400">
          Status: {status || 'desconocido'}<br />
          Intentos totales: {retryCount}
        </div>
        {isRetrying ? (
          <div className="text-lg text-yellow-400">Reintentando...</div>
        ) : (
          <button
            onClick={() => {
              setRetryCount(c => c + 1);
              setIsRetrying(true);
              setTimeout(() => {
                window.location.reload();
              }, 1000); // 1 segundo de "Reintentando..." antes de reload
            }}
            disabled={isRetrying}
            className="px-8 py-4 bg-white text-black rounded-xl font-bold text-lg active:scale-95 transition-transform disabled:opacity-50"
          >
            Reintentar detección
          </button>
        )}
      </div>
    );
  }

  // Verificando
  if (!verified) {
    return (
      <div className="w-screen h-screen flex items-center justify-center bg-black text-white text-center p-6">
        Verificando World ID...<br />
        Wallet detectada: {walletAddress.slice(0, 6)}...
      </div>
    );
  }

  // Pantalla principal
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
