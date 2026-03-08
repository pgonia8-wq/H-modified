import React, { useState, useEffect } from 'react';
import PostCard from '../components/PostCard';
import { supabase } from '../supabaseClient';
import { MiniKit } from '@worldcoin/minikit-js';

const PAGE_SIZE = 8;

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
  const [price, setPrice] = useState<number>(0);
  const [slotsLeft, setSlotsLeft] = useState<number>(0);
  const [showInsufficientFunds, setShowInsufficientFunds] = useState(false);

  useEffect(() => {
    if (selectedTier) {
      const fetchPriceAndSlots = async () => {

        const { count, error } = await supabase
          .from("upgrades")
          .select("*", { count: "exact", head: true })
          .eq("tier", selectedTier);

        if (error) {
          console.error("[UPGRADE] Error slots:", error);
          return;
        }

        const limit = selectedTier === "premium" ? 10000 : 3000;

        const used = count || 0;

        setSlotsLeft(limit - used);

        setPrice(
          used < limit
            ? (selectedTier === "premium" ? 10 : 15)
            : (selectedTier === "premium" ? 20 : 35)
        );
      };

      fetchPriceAndSlots();
    }
  }, [selectedTier]);

  const handleUpgrade = () => {
    setShowUpgradeOptions(true);
  };

  const selectTier = (tier: "premium" | "premium+") => {
    setSelectedTier(tier);
    setShowSlideModal(true);
  };

  const cancelUpgrade = () => {
    setShowSlideModal(false);
    setSelectedTier(null);
    setShowUpgradeOptions(false);
  };

  const confirmUpgrade = async () => {

    if (!currentUserId || !selectedTier) {
      setUpgradeError("No se encontró tu ID o tier seleccionado.");
      return;
    }

    setLoadingUpgrade(true);
    setUpgradeError(null);
    setShowInsufficientFunds(false);

    console.log("[UPGRADE] Iniciando pago para tier:", selectedTier, "precio:", price, "userId:", currentUserId);

    try {

      if (!MiniKit.isInstalled()) {
        throw new Error("MiniKit no instalado o World App no detectada");
      }

      const payRes = await MiniKit.commandsAsync.pay({
        reference: "upgrade-" + Date.now(),
        to: "0x4df4a99b05945b0594db02127ad3cdffea619f4cb",
        tokens: [
          {
            symbol: "WLD",
            amount: price.toString()
          }
        ],
        description: `Upgrade ${selectedTier}`
      });

      console.log("[UPGRADE] Pago respuesta:", payRes);

      if (payRes?.finalPayload?.status !== "success") {

        const errorMsg = payRes?.finalPayload?.error || "";

        if (errorMsg.includes("insufficient") || errorMsg.includes("funds")) {
          setShowInsufficientFunds(true);
          throw new Error("Fondos insuficientes en tu wallet");
        }

        throw new Error("Pago cancelado o fallido");
      }

      const transactionId = payRes?.finalPayload?.transaction_id;

      console.log("[UPGRADE] txId obtenido:", transactionId);

      const res = await fetch("/api/upgrade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: currentUserId,
          tier: selectedTier,
          transactionId
        })
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Error ${res.status}: ${text}`);
      }

      const data = await res.json();

      console.log("[UPGRADE] Backend respuesta:", data);

      if (!data.success) throw new Error(data.error || "Error al procesar upgrade");

      alert(`¡Upgrade a ${selectedTier} exitoso! Precio: ${price} WLD. Tu referral token: ${data.referralToken}`);

      cancelUpgrade();

    } catch (err: any) {

      console.error("[UPGRADE] Error completo:", err);

      setUpgradeError(err.message || "Error al procesar el upgrade");

    } finally {

      setLoadingUpgrade(false);

    }
  };

  return (
    <div className="flex flex-col p-4">
      {/* Botón Upgrade */}
      <div className="mb-6">
        <button
          onClick={handleUpgrade}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold shadow-lg"
        >
          Upgrade
        </button>
      </div>

      {/* Opciones */}
      {showUpgradeOptions && (
        <div className="space-y-4 mb-6">
          <button
            onClick={() => selectTier("premium")}
            className="w-full py-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold shadow-md"
          >
            Premium
          </button>
          <button
            onClick={() => selectTier("premium+")}
            className="w-full py-4 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold shadow-md"
          >
            Premium+
          </button>
        </div>
      )}

      {/* Feed */}
      {loading ? (
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
      ) : !posts || posts.length === 0 ? (
        <p className="text-gray-500 text-center py-10 px-2">No hay posts todavía.</p>
      ) : (
        <div className="space-y-5">
          {posts.map((post) => (
            <PostCard key={post.id} post={post} currentUserId={currentUserId} />
          ))}
        </div>
      )}

      {upgradeError && <p className="text-red-500 text-center py-4 mt-4">{upgradeError}</p>}
    </div>
  );
};

export default FeedPage;
