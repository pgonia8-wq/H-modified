import React, { useState, useContext } from "react";
import { supabase } from "../supabaseClient";
import { useUserBalance } from "../lib/useUserBalance";
import { useFollow } from "../lib/useFollow";
import { ThemeContext } from "../lib/ThemeContext";

interface PostCardProps {
  post: any;
  currentUserId: string | null;
}

const PostCard: React.FC<PostCardProps> = ({ post, currentUserId }) => {
  const { balance, boost } = useUserBalance(currentUserId);
  const { theme, accentColor } = useContext(ThemeContext);
  const { isFollowing, toggleFollow, loading: followLoading } =
    useFollow(currentUserId, post.user_id);

  const [tipAmount, setTipAmount] = useState<number>(0);

  const handleTip = async () => {
    if (!currentUserId) return alert("Debes iniciar sesión");

    if (tipAmount < 0.5) {
      return alert("El tip mínimo es 0.5 WLD");
    }

    if (tipAmount > balance) {
      return alert("No tienes suficiente WLD");
    }

    const { error } = await supabase.rpc("transfer_tip", {
      from_user_id: currentUserId,
      to_user_id: post.user_id,
      tip_amount: tipAmount,
    });

    if (error) {
      console.error(error);
      return alert("Error enviando tip");
    }

    alert(`Tip enviado: ${tipAmount} WLD (92% usuario / 8% app)`);

    setTipAmount(0);
  };

  const handleBoost = async () => {
    const boostCost = 5;

    if (!currentUserId || balance < boostCost) {
      return alert("No tienes suficiente WLD");
    }

    const { error } = await supabase
      .from("user_balances")
      .update({ wld_balance: balance - boostCost })
      .eq("user_id", currentUserId);

    if (error) {
      console.error(error);
      return alert("Error aplicando boost");
    }

    alert("Post potenciado con Boost 🚀");
  };

  const username = post.profile?.username || "Anon";
  const avatar =
    post.profile?.avatar_url || "/default-avatar.png";

  return (
    <div
      className={`rounded-2xl border backdrop-blur-md p-4 space-y-4 transition-all duration-200 shadow-md hover:shadow-lg ${
        theme === "dark"
          ? "bg-gray-900/70 border-white/10 text-white"
          : "bg-white border-black/10 text-black"
      }`}
      style={{ borderColor: accentColor }}
    >
      {/* HEADER */}
      <div className="flex justify-between items-center">

        <div className="flex items-center gap-3">

          {/* Avatar */}
          <img
            src={avatar}
            alt="avatar"
            className="w-10 h-10 rounded-full object-cover border border-white/10"
          />

          {/* Username */}
          <div className="flex flex-col leading-tight">
            <span className="font-semibold text-sm">
              {username}
            </span>

            {post.timestamp && (
              <span className="text-xs text-gray-400">
                {new Date(post.timestamp).toLocaleString()}
              </span>
            )}
          </div>
        </div>

        {/* FOLLOW */}
        {currentUserId && currentUserId !== post.user_id && (
          <button
            onClick={toggleFollow}
            disabled={followLoading}
            className="px-3 py-1 rounded-full text-xs font-semibold transition hover:opacity-90"
            style={{
              backgroundColor: isFollowing
                ? "#444"
                : accentColor,
              color: "white",
            }}
          >
            {followLoading
              ? "..."
              : isFollowing
              ? "Siguiendo"
              : "Seguir"}
          </button>
        )}
      </div>

      {/* CONTENT */}
      <div className="text-[15px] leading-relaxed whitespace-pre-wrap">
        {post.content}
      </div>

      {/* TIP + BOOST */}
      <div className="flex flex-wrap gap-2 items-center pt-2 border-t border-white/10">

        <input
          type="number"
          min={0.5}
          step={0.1}
          value={tipAmount || ""}
          onChange={(e) =>
            setTipAmount(Number(e.target.value))
          }
          className={`w-24 px-2 py-1 rounded-lg text-sm outline-none ${
            theme === "dark"
              ? "bg-black border border-gray-700 text-white"
              : "bg-gray-100 border border-gray-300 text-black"
          }`}
          placeholder="Tip WLD"
        />

        <button
          onClick={handleTip}
          className="px-3 py-1 rounded-lg text-sm font-medium text-white shadow-sm hover:opacity-90 transition"
          style={{ backgroundColor: accentColor }}
        >
          Tip
        </button>

        <button
          onClick={handleBoost}
          className="px-3 py-1 rounded-lg text-sm font-medium text-white shadow-sm hover:opacity-90 transition"
          style={{ backgroundColor: accentColor }}
        >
          Boost
        </button>

      </div>

      {/* BALANCE */}
      <div className="text-xs text-gray-400">
        Balance: {balance.toFixed(2)} WLD
      </div>
    </div>
  );
};

export default PostCard;
