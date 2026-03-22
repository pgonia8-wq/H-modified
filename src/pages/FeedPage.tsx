import React, { useState, useEffect, useContext } from "react";
import PostCard from "../components/PostCard";
import { supabase } from "../supabaseClient";
import { MiniKit, Tokens, tokenToDecimals } from "@worldcoin/minikit-js";
import { LanguageContext } from "../LanguageContext";
import { ThemeContext } from "../lib/ThemeContext";
import { motion, AnimatePresence } from "framer-motion";
import {
  Star,
  Crown,
  Zap,
  Eye,
  BarChart2,
  Shield,
  Edit3,
  MessageCircle,
  Users,
  Sparkles,
  Trophy,
  Lock,
  X,
  CheckCircle2,
} from "lucide-react";

const RECEIVER = "0xdf4a991bc05945bd0212e773adcff6ea619f4c4b";

interface FeedPageProps {
  posts: any[];
  loading?: boolean;
  error?: string | null;
  currentUserId: string | null;
  userTier: "free" | "basic" | "premium" | "premium+";
  onUpgradeSuccess?: () => void;
}

const premiumBenefits = [
  { icon: <Edit3 size={18} />, text: "Publicaciones más largas (2,000 caracteres)" },
  { icon: <Zap size={18} />, text: "Prioridad en el feed" },
  { icon: <Star size={18} />, text: "Badge Premium exclusivo" },
  { icon: <MessageCircle size={18} />, text: "Salas Classic" },
  { icon: <Shield size={18} />, text: "Sin anuncios" },
  { icon: <Edit3 size={18} />, text: "Editar posts hasta 30 minutos" },
  { icon: <Eye size={18} />, text: "Ver visitas a tu perfil" },
  { icon: <Users size={18} />, text: "Soporte prioritario" },
];

const premiumPlusBenefits = [
  { icon: <CheckCircle2 size={18} />, text: "Todo lo incluido en Premium" },
  { icon: <Edit3 size={18} />, text: "Publicaciones ilimitadas (10,000 caracteres)" },
  { icon: <Crown size={18} />, text: "Badge dorado animado" },
  { icon: <Trophy size={18} />, text: "Salas Gold y VIP Lounge" },
  { icon: <Zap size={18} />, text: "Prioridad máxima en el feed" },
  { icon: <Eye size={18} />, text: "Ver likes y reposts anónimos" },
  { icon: <Edit3 size={18} />, text: "Editar posts sin límite de tiempo" },
  { icon: <BarChart2 size={18} />, text: "Analíticas avanzadas" },
  { icon: <Shield size={18} />, text: "Soporte VIP 24/7" },
  { icon: <Sparkles size={18} />, text: "Invitaciones exclusivas a eventos" },
];

const FeedPage: React.FC<FeedPageProps> = ({
  posts,
  loading,
  error,
  currentUserId,
  userTier,
  onUpgradeSuccess,
}) => {
  const { t } = useContext(LanguageContext);
  const { theme } = useContext(ThemeContext);

  const [showUpgradeOptions, setShowUpgradeOptions] = useState(false);
  const [selectedTier, setSelectedTier] = useState<"premium" | "premium+" | null>(null);
  const [showSlideModal, setShowSlideModal] = useState(false);
  const [loadingUpgrade, setLoadingUpgrade] = useState(false);
  const [upgradeError, setUpgradeError] = useState<string | null>(null);
  const [price, setPrice] = useState(0);

  const sortedPosts = [...posts].sort((a, b) => {
    const now = Date.now();

    const calculateScore = (post: any) => {
      const weightLikes = 1;
      const weightComments = 2;
      const weightReposts = 2;
      const weightTips = 3;
      const weightBoost = 15;

      const ageHours = (now - new Date(post.timestamp).getTime()) / 3600000;
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
        post.boosted_until && new Date(post.boosted_until) > new Date()
          ? weightBoost
          : 0;

      const tagScore = post.tags ? post.tags.length * 0.5 : 0;
      const velocity =
        (likes + comments * 2 + reposts * 2 + tips * 3) / Math.max(ageHours, 1);
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
            token_amount: tokenToDecimals(price, Tokens.WLD).toString(),
          },
        ],
        description: `Upgrade ${selectedTier}`,
      });

      console.log("[UPGRADE] pay response:", payRes);

      if (payRes?.finalPayload?.status !== "success") {
        throw new Error(
          payRes?.finalPayload?.description ||
            (t ? t("pago_cancelado") : "Pago cancelado")
        );
      }

      const transactionId = payRes?.finalPayload?.transaction_id;

      const res = await fetch("/api/upgrade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: currentUserId,
          tier: selectedTier,
          transactionId,
        }),
      });

      const data = await res.json();

      if (!data.success) {
        throw new Error(
          data.error || (t ? t("error_upgrade") : "Error al procesar upgrade")
        );
      }

      alert(
        t
          ? t("upgrade_exitoso") + ` ${selectedTier}`
          : `Upgrade ${selectedTier} exitoso`
      );

      onUpgradeSuccess?.();
      cancelUpgrade();
    } catch (err: any) {
      console.error("[UPGRADE] error:", err);
      setUpgradeError(
        err.message || (t ? t("error_upgrade") : "Error en el upgrade")
      );
    } finally {
      setLoadingUpgrade(false);
    }
  };

  const isPremiumPlus = selectedTier === "premium+";
  const benefits = isPremiumPlus ? premiumPlusBenefits : premiumBenefits;

  return (
    <div
      className={`flex flex-col p-4 ${
        theme === "dark" ? "bg-gray-900 text-white" : "bg-white text-black"
      }`}
    >
      <div className="mb-6">
        <motion.button
          whileHover={{ scale: 1.02, brightness: 1.1 }}
          whileTap={{ scale: 0.97 }}
          onClick={handleUpgrade}
          className="w-full py-3 rounded-xl font-bold shadow-lg bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600 text-white tracking-wide text-base"
          style={{
            boxShadow: "0 4px 24px 0 rgba(99,60,220,0.25)",
          }}
        >
          {t ? t("upgrade") : "✦ Upgrade"}
        </motion.button>
      </div>

      <AnimatePresence>
        {showUpgradeOptions && (
          <motion.div
            key="upgrade-options"
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="flex gap-3 mb-6"
          >
            <motion.button
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              onClick={() => selectTier("premium")}
              className="flex-1 py-5 rounded-2xl font-bold flex flex-col items-center gap-2 relative overflow-hidden"
              style={{
                background:
                  "linear-gradient(135deg, #4f46e5 0%, #7c3aed 60%, #a78bfa 100%)",
                boxShadow: "0 6px 32px 0 rgba(99,60,220,0.30)",
              }}
            >
              <Star size={26} className="text-yellow-300 drop-shadow" />
              <span className="text-white text-lg tracking-wide">Premium</span>
              <span className="text-indigo-200 text-xs font-normal">Acceso prioritario</span>
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              onClick={() => selectTier("premium+")}
              className="flex-1 py-5 rounded-2xl font-bold flex flex-col items-center gap-2 relative overflow-hidden"
              style={{
                background:
                  "linear-gradient(135deg, #b45309 0%, #d97706 40%, #fbbf24 80%, #fde68a 100%)",
                boxShadow: "0 6px 32px 0 rgba(217,119,6,0.35)",
              }}
            >
              <Crown size={26} className="text-white drop-shadow" />
              <span className="text-white text-lg tracking-wide">Premium+</span>
              <span className="text-yellow-100 text-xs font-normal">Nivel máximo VIP</span>
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

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

      <AnimatePresence>
        {showSlideModal && selectedTier && (
          <motion.div
            key="modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex items-center justify-center px-3"
            style={{ backdropFilter: "blur(16px)", background: "rgba(0,0,0,0.72)" }}
            onClick={(e) => {
              if (e.target === e.currentTarget) cancelUpgrade();
            }}
          >
            <motion.div
              key="modal-content"
              initial={{ opacity: 0, scale: 0.93, y: 32 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.93, y: 32 }}
              transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
              className="w-full max-w-md rounded-3xl overflow-hidden relative"
              style={{
                background: isPremiumPlus
                  ? "linear-gradient(160deg, #1a1206 0%, #2d1e07 30%, #1c1400 60%, #111 100%)"
                  : "linear-gradient(160deg, #0f0c1e 0%, #1a1040 40%, #0d0a1e 100%)",
                boxShadow: isPremiumPlus
                  ? "0 32px 80px 0 rgba(217,119,6,0.40), 0 0 0 1px rgba(251,191,36,0.15)"
                  : "0 32px 80px 0 rgba(99,60,220,0.45), 0 0 0 1px rgba(139,92,246,0.18)",
              }}
            >
              <div
                className="absolute inset-x-0 top-0 h-1 rounded-t-3xl"
                style={{
                  background: isPremiumPlus
                    ? "linear-gradient(90deg, #b45309, #fbbf24, #fde68a, #fbbf24, #b45309)"
                    : "linear-gradient(90deg, #4f46e5, #7c3aed, #a78bfa, #7c3aed, #4f46e5)",
                }}
              />

              <button
                onClick={cancelUpgrade}
                className="absolute top-4 right-4 z-10 rounded-full p-1.5 text-gray-400 hover:text-white transition-colors"
                style={{ background: "rgba(255,255,255,0.08)" }}
              >
                <X size={18} />
              </button>

              <div className="p-7 pb-2">
                <div className="flex flex-col items-center mb-5">
                  <motion.div
                    animate={
                      isPremiumPlus
                        ? { rotate: [0, -8, 8, -4, 4, 0] }
                        : { scale: [1, 1.12, 1] }
                    }
                    transition={{ repeat: Infinity, duration: 3.5, ease: "easeInOut" }}
                    className="mb-3"
                  >
                    {isPremiumPlus ? (
                      <Crown size={48} className="text-yellow-400 drop-shadow-lg" />
                    ) : (
                      <Star size={48} className="text-violet-400 drop-shadow-lg" />
                    )}
                  </motion.div>

                  <h2 className="text-2xl font-extrabold text-white text-center leading-tight mb-1">
                    {isPremiumPlus
                      ? "¡Conviértete en Premium+!"
                      : "¡Desbloquea Premium!"}
                  </h2>
                  <p
                    className="text-sm text-center font-medium"
                    style={{ color: isPremiumPlus ? "#fde68a" : "#c4b5fd" }}
                  >
                    {isPremiumPlus
                      ? "El nivel máximo con ventajas únicas"
                      : "Lleva tu experiencia al siguiente nivel"}
                  </p>
                </div>

                <div
                  className="rounded-2xl p-4 mb-5 overflow-y-auto"
                  style={{
                    maxHeight: "38vh",
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.07)",
                  }}
                >
                  <ul className="space-y-2.5">
                    {benefits.map((b, i) => (
                      <motion.li
                        key={i}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.045, duration: 0.25 }}
                        className="flex items-center gap-3"
                      >
                        <span
                          className="flex-shrink-0 rounded-full p-1.5"
                          style={{
                            background: isPremiumPlus
                              ? "rgba(251,191,36,0.15)"
                              : "rgba(139,92,246,0.18)",
                            color: isPremiumPlus ? "#fbbf24" : "#a78bfa",
                          }}
                        >
                          {b.icon}
                        </span>
                        <span className="text-sm text-gray-200 leading-snug">{b.text}</span>
                      </motion.li>
                    ))}
                  </ul>
                </div>

                <div
                  className="flex items-center justify-center gap-2 mb-5 rounded-xl py-2.5"
                  style={{ background: "rgba(255,255,255,0.05)" }}
                >
                  <Lock size={14} style={{ color: isPremiumPlus ? "#fbbf24" : "#a78bfa" }} />
                  <span className="text-white font-bold text-lg">
                    {price ? `${price} WLD` : "..."}
                  </span>
                  <span className="text-gray-400 text-sm">pago único</span>
                </div>
              </div>

              <div className="px-7 pb-7 flex flex-col gap-3">
                <motion.button
                  whileHover={{ scale: 1.02, filter: "brightness(1.1)" }}
                  whileTap={{ scale: 0.97 }}
                  onClick={confirmUpgrade}
                  disabled={loadingUpgrade}
                  className="w-full py-4 rounded-2xl font-extrabold text-base tracking-wide transition-all"
                  style={{
                    background: isPremiumPlus
                      ? "linear-gradient(90deg, #b45309, #d97706, #fbbf24)"
                      : "linear-gradient(90deg, #4f46e5, #7c3aed, #8b5cf6)",
                    color: isPremiumPlus ? "#1a1206" : "#fff",
                    boxShadow: isPremiumPlus
                      ? "0 6px 28px 0 rgba(217,119,6,0.45)"
                      : "0 6px 28px 0 rgba(99,60,220,0.45)",
                    opacity: loadingUpgrade ? 0.7 : 1,
                  }}
                >
                  {loadingUpgrade
                    ? t
                      ? t("procesando")
                      : "Procesando..."
                    : `Aceptar y pagar ${price ? `${price} WLD` : ""}`}
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={cancelUpgrade}
                  className="w-full py-3.5 rounded-2xl font-semibold text-sm text-gray-400 hover:text-gray-200 transition-colors"
                  style={{ background: "rgba(255,255,255,0.06)" }}
                >
                  {t ? t("cancelar") : "Cancelar"}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default FeedPage;
