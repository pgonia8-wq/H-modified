import React, { useState, useEffect, useContext } from "react";
import PostCard from "../components/PostCard";
import { supabase } from "../supabaseClient";
import { MiniKit, Tokens, tokenToDecimals } from "@worldcoin/minikit-js";
import { LanguageContext } from "../LanguageContext"; 
import { ThemeContext } from "../lib/ThemeContext"; // <-- agregado

const RECEIVER = "0xdf4a991bc05945bd0212e773adcff6ea619f4c4b";

interface FeedPageProps {
  posts: any[];
  loading?: boolean;
  error?: string | null;
  currentUserId: string | null;
  userTier: "free" | "basic" | "premium" | "premium+";
  onUpgradeSuccess?: () => void;
}

const FeedPage: React.FC<FeedPageProps> = ({
  posts,
  loading,
  error,
  currentUserId,
  userTier,
  onUpgradeSuccess
}) => {

  const { t } = useContext(LanguageContext);
  const { theme } = useContext(ThemeContext); // <-- agregado

  const [showUpgradeOptions, setShowUpgradeOptions] = useState(false);
  const [selectedTier, setSelectedTier] = useState<"premium" | "premium+" | null>(null);
  const [showSlideModal, setShowSlideModal] = useState(false);
  const [loadingUpgrade, setLoadingUpgrade] = useState(false);
  const [upgradeError, setUpgradeError] = useState<string | null>(null);
  const [price, setPrice] = useState(0);

  // ---- Algoritmo de ranking avanzado ----
  const sortedPosts = [...posts].sort((a, b) => {
    const now = Date.now();

    const calculateScore = (post: any) => {
      const weightLikes = 1;
      const weightComments = 2;
      const weightReposts = 2;
      const weightTips = 3;
      const weightBoost = 15;

      const ageHours =
        (now - new Date(post.timestamp).getTime()) / 3600000;

      const recencyDecay = Math.exp(-ageHours / 24);
      const likes = post.likes || 0;
      const comments = post.comments || 0;
      const reposts = post.reposts || 0;
      const tips = post.tips_total || 0;

      const engagement =
        likes * weightLikes +
        comments * weightComments +
        reposts * weightReposts +
        tips * weightTips;

      const engagementScore = engagement / (1 + ageHours);

      const boost =
        post.boosted_until &&
        new Date(post.boosted_until) > new Date()
          ? weightBoost
          : 0;

      const tagScore = post.tags ? post.tags.length * 0.5 : 0;
      const velocity =
        (likes + comments * 2 + reposts * 2 + tips * 3) /
        Math.max(ageHours, 1);
      const velocityScore = velocity * 0.5;

      return engagementScore + recencyDecay + boost + tagScore + velocityScore;
    };

    return calculateScore(b) - calculateScore(a);
  });

  useEffect(() => {
    if (!selectedTier) return;

    const fetchSlots = async () => {
      const { count } = await supabase
        .from("upgrades")
        .select("*", { count: "exact", head: true })
        .eq("tier", selectedTier);

      const limit = selectedTier === "premium" ? 10000 : 3000;
      const used = count || 0;

      const calculatedPrice =
        used < limit
          ? selectedTier === "premium"
            ? 10
            : 15
          : selectedTier === "premium"
          ? 20
          : 35;

      setPrice(calculatedPrice);
    };

    fetchSlots();
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
    setUpgradeError(null);

    if (!price) {
      setUpgradeError(t ? t("calculando_precio") : "Calculando precio, intenta nuevamente.");
      return;
    }

    if (!currentUserId || !selectedTier) {
      setUpgradeError(t ? t("no_usuario_o_tier") : "No se encontró tu ID o tier seleccionado");
      return;
    }

    if (!MiniKit.isInstalled()) {
      setUpgradeError(t ? t("minikit_no_detectado") : "MiniKit no detectado dentro de World App");
      return;
    }

    setLoadingUpgrade(true);

    try {
      const payRes = await MiniKit.commandsAsync.pay({
        reference: "upgrade-" + Date.now(),
        to: RECEIVER,
        tokens: [
          {
            symbol: Tokens.WLD,
            token_amount: tokenToDecimals(price, Tokens.WLD).toString()
          }
        ],
        description: `Upgrade ${selectedTier}`
      });

      console.log("[UPGRADE] pay response:", payRes);

      if (payRes?.finalPayload?.status !== "success") {
        throw new Error(payRes?.finalPayload?.description || (t ? t("pago_cancelado") : "Pago cancelado"));
      }

      const transactionId = payRes?.finalPayload?.transaction_id;

      const res = await fetch("/api/upgrade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: currentUserId,
          tier: selectedTier,
          transactionId
        })
      });

      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || (t ? t("error_upgrade") : "Error al procesar upgrade"));
      }

      alert(t ? t("upgrade_exitoso") + ` ${selectedTier}` : `Upgrade ${selectedTier} exitoso`);

      onUpgradeSuccess?.();

      cancelUpgrade();

    } catch (err: any) {
      console.error("[UPGRADE] error:", err);
      setUpgradeError(err.message || (t ? t("error_upgrade") : "Error en el upgrade"));
    } finally {
      setLoadingUpgrade(false);
    }
  };

  return (
    <div className={`flex flex-col p-4 ${theme === "dark" ? "bg-gray-900 text-white" : "bg-white text-black"}`}>

      <div className="mb-6">
        <button
          onClick={handleUpgrade}
          className={`w-full py-3 rounded-xl font-bold shadow-lg ${theme === "dark" ? "bg-gradient-to-r from-purple-700 to-pink-700 text-white" : "bg-gradient-to-r from-purple-600 to-pink-600 text-white"}`}
        >
          {t ? t("upgrade") : "Upgrade"}
        </button>
      </div>

      {showUpgradeOptions && (
        <div className="space-y-4 mb-6">

          <button
            onClick={() => selectTier("premium")}
            className={`w-full py-4 rounded-xl font-bold ${theme === "dark" ? "bg-blue-700 text-white" : "bg-blue-600 text-white"}`}
          >
            {t ? t("premium") : "Premium"}
          </button>

          <button
            onClick={() => selectTier("premium+")}
            className={`w-full py-4 rounded-xl font-bold ${theme === "dark" ? "bg-purple-700 text-white" : "bg-purple-600 text-white"}`}
          >
            {t ? t("premium_plus") : "Premium+"}
          </button>

        </div>
      )}

      {loading ? (
        <p className="text-center py-10">{t ? t("cargando") : "Cargando..."}</p>
      ) : error ? (
        <p className="text-red-500 text-center py-10">{error}</p>
      ) : (
        <div className="space-y-5">
          {sortedPosts?.map((post) => (
            <PostCard key={post.id} post={post} currentUserId={currentUserId} />
          ))}
        </div>
      )}

      {upgradeError && (
        <p className="text-red-500 text-center py-4">{upgradeError}</p>
      )}

      {showSlideModal && selectedTier && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50">

          <div className={`w-full max-w-md rounded-t-3xl p-6 ${theme === "dark" ? "bg-gray-900" : "bg-white"}`}>

            <h2 className={`text-xl font-bold mb-4 ${theme === "dark" ? "text-white" : "text-black"}`}>
              {t ? t("beneficios_de") : "Beneficios de"} {selectedTier}
            </h2>

            <p className={`text-center mb-4 ${theme === "dark" ? "text-gray-300" : "text-black"}`}>
              {t ? t("precio") : "Precio"}: {price} WLD
            </p>

            <div className="flex gap-4">

              <button
                onClick={cancelUpgrade}
                className={`flex-1 py-3 rounded-2xl font-bold ${theme === "dark" ? "bg-gray-700 text-white" : "bg-gray-200 text-black"}`}
              >
                {t ? t("cancelar") : "Cancelar"}
              </button>

              <button
                onClick={confirmUpgrade}
                disabled={loadingUpgrade}
                className={`flex-1 py-3 rounded-2xl font-bold ${theme === "dark" ? "bg-yellow-500 text-black" : "bg-yellow-400 text-black"}`}
              >
                {loadingUpgrade ? (t ? t("procesando") : "Procesando...") : (t ? t("aceptar") : "Aceptar")}
              </button>

            </div>

          </div>

        </div>
      )}

    </div>
  );
};

export default FeedPage;
