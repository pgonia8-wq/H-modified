import { useState, useEffect } from "react";
import { MiniKit, VerificationLevel } from "@worldcoin/minikit-js";
import HomePage from "./pages/HomePage";
import ErrorBoundary from "./components/ErrorBoundary";

function App() {
  const [verified, setVerified] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const storedUserId = localStorage.getItem('userId');
    console.log("[APP] (useEffect) userId desde localStorage:", storedUserId);
    if (storedUserId) {
      setUserId(storedUserId);
      setVerified(true);
      console.log("[APP] (useEffect) Usuario ya verificado, estado actualizado", storedUserId);
    }
  }, []);

  const handleVerify = async () => {
    try {
      setError(null);
      setMessage("Verificando con H…");
      console.log("[APP] Iniciando verificación MiniKit");

      if (!MiniKit.isInstalled()) {
        setError("World App no detectada");
        console.log("[APP] MiniKit no detectado");
        return;
      }

      const verifyRes = await MiniKit.commandsAsync.verify({
        action: "verify-user",
        verification_level: VerificationLevel.Device,
      });

      console.log("[APP] Resultado verify:", verifyRes);

      const finalPayload = verifyRes?.finalPayload;
      if (!finalPayload || finalPayload.status !== "success") {
        setError("Verificación cancelada o fallida");
        console.log("[APP] verify.finalPayload inválido o cancelado:", finalPayload);
        return;
      }

      const proofData = finalPayload.proof;
      if (!proofData) {
        setError("No se encontró proof válido");
        console.log("[APP] proofData no existe:", finalPayload);
        return;
      }

      const id = proofData.nullifier_hash;
      console.log("[APP] nullifier_hash obtenido:", id);

      if (!id) {
        setError("nullifier_hash es undefined. Verifica MiniKit.");
        console.log("[APP] nullifier_hash es undefined en proofData:", proofData);
        return;
      }

      const body = {
        proof: proofData.proof,
        merkle_root: proofData.merkle_root,
        nullifier_hash: id,
        verification_level: proofData.verification_level,
        action: "verify-user",
        max_age: 7200,
      };

      console.log("[APP] Enviando POST a /api/verify con body:", body);

      const res = await fetch("/api/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const result = await res.json();
      console.log("[APP] Respuesta backend /api/verify:", result);

      if (result.success && result.userId) {
        setVerified(true);
        setUserId(result.userId);
        localStorage.setItem('userId', result.userId);
        setMessage("✅ Verificación exitosa");
        console.log("[APP] Usuario verificado y guardado correctamente:", result.userId);
      } else {
        setError("Backend rechazó la prueba: " + (result.error || "userId missing"));
        console.log("[APP] Backend rechazó la prueba:", result.error, "userId:", result.userId);
      }

    } catch (err: any) {
      setError("Error durante verificación: " + err.message);
      console.log("[APP] Error catch:", err);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      {!verified || !userId ? (
        <div className="bg-white rounded-2xl shadow-xl p-8 flex flex-col items-center w-full max-w-md">
          <img src="/logo.png" alt="Logo H" className="w-40 h-40 rounded-full mb-6 shadow-lg object-contain" />
          <p className="text-black text-2xl font-bold mb-6 text-center">Verificando con H…</p>
          <button onClick={handleVerify} className="px-8 py-3 bg-black text-white rounded-full shadow-lg hover:bg-gray-800 transition">
            Iniciar verificación
          </button>
          {message && <p className="mt-4 text-gray-700">{message}</p>}
          {error && <p className="mt-2 text-red-600">{error}</p>}
        </div>
      ) : (
        <ErrorBoundary>
          <HomePage userId={userId} />
        </ErrorBoundary>
      )}
    </div>
  );
}

export default App;
