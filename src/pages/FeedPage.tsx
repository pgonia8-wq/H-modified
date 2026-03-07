import React, { useState } from 'react';
import PostCard from '../components/PostCard';

interface Post {
  id: string;
  content?: string;
  timestamp: string;
  profile?: {
    username?: string;
  };
  [key: string]: any;
}

interface FeedPageProps {
  posts: Post[];
  loading?: boolean;
  error?: string | null;
  currentUserId: string | null;
  userTier: "free" | "premium" | "premium+";
}

const FeedPage: React.FC<FeedPageProps> = ({ posts, loading, error, currentUserId, userTier }) => {
  const [showUpgradeOptions, setShowUpgradeOptions] = useState(false);
  const [selectedTier, setSelectedTier] = useState<"premium" | "premium+" | null>(null);
  const [showSlideModal, setShowSlideModal] = useState(false);
  const [loadingUpgrade, setLoadingUpgrade] = useState(false);

  const handleUpgrade = async (tier: "premium" | "premium+") => {
    setSelectedTier(tier);
    setShowSlideModal(true);
  };

  const confirmUpgrade = async () => {
    if (!currentUserId || !selectedTier) return alert("No se encontró tu ID o tier seleccionado.");

    setLoadingUpgrade(true);
    try {
      const transactionId = crypto.randomUUID();
      const res = await fetch("/api/upgrade.mjs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: currentUserId, tier: selectedTier, transactionId }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Error al procesar upgrade");

      alert(`¡Upgrade a ${selectedTier} exitoso! Precio: ${data.price} WLD`);
      setShowUpgradeOptions(false);
      setShowSlideModal(false);
      setSelectedTier(null);
    } catch (err: any) {
      console.error("Upgrade error:", err);
      alert("Error al procesar upgrade: " + (err.message || "Intenta de nuevo"));
    } finally {
      setLoadingUpgrade(false);
    }
  };

  const cancelUpgrade = () => {
    setShowSlideModal(false);
    setSelectedTier(null);
  };

     // Banner de upgrade
  const renderUpgradeBanner = () => {
  if (userTier === "premium+") return null;
  return (
    <div className="w-full max-w-2xl px-4">
      {!showUpgradeOptions ? (
        <button
          onClick={() => setShowUpgradeOptions(true)}
          className="w-full py-3 bg-yellow-500 hover:bg-yellow-400 text-black font-bold rounded-2xl shadow-md mt-2"
        >
          Upgrade
        </button>
      ) : (
        <div className="flex gap-4 mt-2">
          <button
            onClick={() => handleUpgrade("premium")}
            disabled={loadingUpgrade}
            className="flex-1 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold rounded-2xl shadow-md flex items-center justify-center"
          >
            Premium
          </button>
          <button
            onClick={() => handleUpgrade("premium+")}
            disabled={loadingUpgrade}
            className="flex-1 py-3 bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-500 hover:to-teal-500 text-white font-bold rounded-2xl shadow-md flex items-center justify-center"
          >
            Premium+
          </button>
        </div>
      )}

      {/* Slide Modal */}
      {showSlideModal && selectedTier && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50">
          <div className="w-full max-w-md bg-gray-900 rounded-t-3xl p-6 animate-slide-up">
            <h2 className="text-xl font-bold text-white mb-4">Beneficios de {selectedTier}</h2>
            <ul className="text-gray-200 mb-6 list-disc list-inside space-y-2">
              {selectedTier === "premium" && (
                <>
                  <li>Puedes recibir tips ilimitados</li>
                  <li>Boost 5 veces por semana</li>
                  <li>1 WLD por cada referido que se registre</li>
                </>
              )}
              {selectedTier === "premium+" && (
                <>
                  <li>Puedes recibir tips ilimitados</li>
                  <li>Boost ilimitado</li>
                  <li>Bonificación extra de engagement</li>
                </>
              )}
            </ul>
            <div className="flex gap-4">
              <button
                onClick={cancelUpgrade}
                className="flex-1 py-3 bg-gray-700 text-white rounded-2xl font-bold"
              >
                Cancelar
              </button>
              <button
                onClick={confirmUpgrade}
                disabled={loadingUpgrade}
                className="flex-1 py-3 bg-yellow-500 text-black rounded-2xl font-bold"
              >
                {loadingUpgrade ? "Procesando..." : "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};             
                  

export default FeedPage;
