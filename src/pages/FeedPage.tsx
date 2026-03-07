import React, { useState, useEffect } from 'react';
import PostCard from '../components/PostCard';
import { MiniKit } from '@worldcoin/minikit-js';  // ← agregamos MiniKit para pay

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
  userTier: "free" | "basic" | "premium" | "premium+";
}

const FeedPage: React.FC<FeedPageProps> = ({ posts, loading, error, currentUserId, userTier }) => {
  const [showUpgradeOptions, setShowUpgradeOptions] = useState(false);
  const [selectedTier, setSelectedTier] = useState<"premium" | "premium+" | null>(null);
  const [showSlideModal, setShowSlideModal] = useState(false);
  const [loadingUpgrade, setLoadingUpgrade] = useState(false);
  const [upgradeError, setUpgradeError] = useState<string | null>(null);
  const [price, setPrice] = useState<number | null>(null);  // ← para mostrar precio dinámico

  useEffect(() => {
    if (selectedTier) {
      const fetchPrice = async () => {
        const res = await fetch(`/api/upgrade?getPrice=true&tier=${selectedTier}`);
        const data = await res.json();
        setPrice(data.price);
      };
      fetchPrice();
    }
  }, [selectedTier]);

  const handleUpgrade = (tier: "premium" | "premium+") => {
    setSelectedTier(tier);
    setShowSlideModal(true);
  };

  const cancelUpgrade = () => {
    setShowSlideModal(false);
    setSelectedTier(null);
  };

  const confirmUpgrade = async () => {
    if (!currentUserId || !selectedTier || !price) return;

    setLoadingUpgrade(true);
    setUpgradeError(null);
    try {
      // Pago real con MiniKit
      const payRes = await MiniKit.commandsAsync.pay({
        amount: price,
        currency: 'WLD',
        recipient: '0x...tu_wallet_app',  // ← reemplaza con wallet de la app para cobrar WLD real
      });

      if (payRes?.status !== "success") {
        throw new Error("Pago cancelado o fallido");
      }

      const transactionId = payRes.transactionId;  // ← tx id real de MiniKit

      const res = await fetch("/api/upgrade", {
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
      // Actualiza userTier local (o refresca app)
      setUserTier(selectedTier);
    } catch (err: any) {
      console.error(err);
      setUpgradeError(err.message);
    } finally {
      setLoadingUpgrade(false);
    }
  };

  return (
    <div className="flex flex-col p-4">
      <div className="mb-4">
        {showUpgradeOptions && (
          <div className="space-y-4">
            <button
              onClick={() => handleUpgrade("premium")}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-500 to-purple-500 text-white font-bold"
            >
              Premium - 10 WLD
            </button>
            <button
              onClick={() => handleUpgrade("premium+")}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold"
            >
              Premium+ - 15 WLD
            </button>
          </div>
        )}
      </div>

      {loading ? (
        // Skeletons
        <div className="space-y-5">
          {Array.from({ length: PAGE_SIZE }).map((_, i) => (
            <div key={i} className="bg-gray-900/60 backdrop-blur-sm rounded-2xl p-4 animate-pulse space-y-4 border border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gray-700" />
                <div className="space-y-2 flex-1">
                  <div className="h-4 bg-gray-700 rounded w-3/4" />
                  <div className="h-3 bg-gray-700 rounded w-1/2" />
                </div>
              </div>
              <div className="space-y-2">
                <div className="h-4 bg-gray-700 rounded w-full" />
                <div className="h-4 bg-gray-700 rounded w-5/6" />
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <p className="text-red-500 text-center py-10 px-2">{error}</p>
      ) : posts.length === 0 ? (
        <p className="text-gray-500 text-center py-10 px-2">No hay posts todavía.</p>
      ) : (
        <div className="space-y-5">
          {posts.map((post) => (
            <PostCard key={post.id} post={post} currentUserId={currentUserId} />
          ))}
        </div>
      )}

      {upgradeError && <p className="text-red-500 text-center py-4">{upgradeError}</p>}

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
            <p className="text-white text-center mb-4">Precio: {price} WLD</p>
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
