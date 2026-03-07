// src/components/PostCard.tsx
import React, { useEffect, useState, useContext } from "react";
import { supabase } from "../supabaseClient";
import { ThemeContext } from "../lib/ThemeContext";
import { useFollow } from "../lib/useFollow";
import { useMiniKitUser } from "../lib/useMiniKitUser";
import { useAvatar } from "../lib/useAvatar";

interface PostCardProps {
  post: any;
  currentUserId: string | null;
}

const PostCard: React.FC<PostCardProps> = ({ post, currentUserId }) => {
  const { theme, accentColor } = useContext(ThemeContext);
  const { balance, payWLD } = useMiniKitUser(currentUserId);

  // Follow
  const { isFollowing, toggleFollow, loading: followLoading } = useFollow(
    currentUserId,
    post.user_id
  );

  // Reactions
  const [liked, setLiked] = useState(false);
  const [likes, setLikes] = useState(post.likes || 0);
  const [reposts, setReposts] = useState(post.reposts || 0);
  const [comments, setComments] = useState(post.comments || 0);

  // Comment Modal
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [commentText, setCommentText] = useState("");

  // Tip / Boost
  const [tipAmount, setTipAmount] = useState<number | "">("");
  const [isBoosting, setIsBoosting] = useState(false);

  // Error state
  const [error, setError] = useState<string | null>(null);

  // Avatar
  const { avatarUrl } = useAvatar(post.user_id);

  // Check if liked
  useEffect(() => {
    if (!currentUserId) return;
    const checkLike = async () => {
      const { data } = await supabase
        .from("likes")
        .select("id")
        .eq("post_id", post.id)
        .eq("user_id", currentUserId)
        .single();
      if (data) setLiked(true);
    };
    checkLike();
  }, [currentUserId, post.id]);

  // Like
  const handleLike = async () => {
    if (!currentUserId) return;
    setError(null);
    try {
      if (liked) {
        await supabase
          .from("likes")
          .delete()
          .eq("post_id", post.id)
          .eq("user_id", currentUserId);
        setLikes((prev) => prev - 1);
        setLiked(false);
      } else {
        await supabase.from("likes").insert({
          post_id: post.id,
          user_id: currentUserId,
        });
        setLikes((prev) => prev + 1);
        setLiked(true);
      }
    } catch (err) {
      console.error(err);
      setError("Error al dar like");
    }
  };

  // Repost
  const handleRepost = async () => {
    if (!currentUserId) return;
    setError(null);
    try {
      await supabase.from("reposts").insert({
        post_id: post.id,
        user_id: currentUserId,
      });
      setReposts((prev) => prev + 1);
    } catch (err) {
      console.error(err);
      setError("Error al repostear");
    }
  };

  // Comment
  const handleComment = async () => {
    if (!currentUserId || !commentText.trim()) return;
    setError(null);
    try {
      await supabase.from("comments").insert({
        post_id: post.id,
        user_id: currentUserId,
        content: commentText.trim(),
        timestamp: new Date().toISOString(),
      });
      setComments((prev) => prev + 1);
      setShowCommentModal(false);
      setCommentText("");
    } catch (err) {
      console.error(err);
      setError("Error al publicar comentario");
    }
  };

  // Tip con comisión del 10%
  const handleTip = async () => {
    if (!currentUserId || !tipAmount || tipAmount <= 0 || tipAmount > balance) {
      setError("Cantidad inválida o fondos insuficientes");
      return;
    }

    setError(null);

    try {
      const appFeePercent = 10; // 10% de comisión para la app
      const appFee = +(tipAmount * (appFeePercent / 100)).toFixed(2);
      const recipientAmount = +(tipAmount - appFee).toFixed(2);

      // Realiza el pago al usuario
      await payWLD(recipientAmount, post.user_id);

      // Registra la transacción
      await supabase.from("tips").insert({
        post_id: post.id,
        from_user_id: currentUserId,
        to_user_id: post.user_id,
        amount: tipAmount,
        app_fee: appFee,
        timestamp: new Date().toISOString(),
      });

      setTipAmount("");
    } catch (err) {
      console.error(err);
      setError("Error al enviar tip");
    }
  };

  // Boost
  const handleBoost = async () => {
    if (!currentUserId || balance < 1) {
      setError("Fondos insuficientes para boost");
      return;
    }

    setIsBoosting(true);
    setError(null);

    try {
      const boostCost = 1;
      const platformFee = +(boostCost * 0.1).toFixed(2);
      const netAmount = +(boostCost - platformFee).toFixed(2);

      await payWLD(boostCost);

      await supabase.from("boosts").insert({
        post_id: post.id,
        user_id: currentUserId,
        amount: boostCost,
        net_amount: netAmount,
        platform_fee: platformFee,
        timestamp: new Date().toISOString(),
      });

      // Actualizar visibility_score
      await supabase
        .from("posts")
        .update({ visibility_score: post.visibility_score + 1 })
        .eq("id", post.id);

      setIsBoosting(false);
    } catch (err) {
      console.error(err);
      setError("Error al boostear");
      setIsBoosting(false);
    }
  };

  return (
    <div className="bg-gray-900/60 backdrop-blur-sm rounded-2xl p-4 space-y-4 border border-white/10">
      <div className="flex items-center gap-3">
        <img
          src={avatarUrl}
          alt={post.profile?.username || "Anon"}
          className="w-10 h-10 rounded-full object-cover"
        />
        <div className="flex-1">
          <h3 className="font-bold text-white">
            {post.profile?.username || "Anon"}{" "}
            {post.profile?.is_premium && "✅"}
          </h3>
          <p className="text-gray-500 text-sm">
            {new Date(post.timestamp || new Date().toISOString()).toLocaleString()}
          </p>
          {post.edited_at && (
            <p className="text-gray-500 text-xs">
              Editado {new Date(post.edited_at).toLocaleString()}
            </p>
          )}
        </div>
        {currentUserId && currentUserId !== post.user_id && (
          <button
            onClick={toggleFollow}
            disabled={followLoading}
            className="px-4 py-1 rounded-full text-sm font-medium"
            style={{ backgroundColor: accentColor }}
          >
            {followLoading ? "..." : isFollowing ? "Unfollow" : "Follow"}
          </button>
        )}
      </div>

      <p className="text-white whitespace-pre-wrap">{post.content}</p>

      <div className="flex gap-4 text-gray-400 text-sm">
        <button onClick={handleLike}>
          {liked ? "❤️" : "♡"} {likes}
        </button>
        <button onClick={() => setShowCommentModal(true)}>💬 {comments}</button>
        <button onClick={handleRepost}>🔁 {reposts}</button>
      </div>

      {/* TIP + BOOST */}
      <div className="flex flex-wrap gap-2 pt-3 items-center">
        <input
          type="number"
          step={0.1}
          min={0.1}
          max={balance}
          value={tipAmount}
          onChange={(e) =>
            setTipAmount(e.target.value ? parseFloat(e.target.value) : "")
          }
          placeholder="Tip WLD"
          className="flex-1 sm:w-20 px-2 py-1 rounded border text-black"
        />
        <button
          onClick={handleTip}
          className="px-3 py-1 rounded text-white font-medium shadow-sm"
          style={{ backgroundColor: accentColor }}
        >
          Tip
        </button>
        <button
          onClick={handleBoost}
          disabled={isBoosting}
          className="px-3 py-1 rounded text-white font-medium shadow-sm"
          style={{ backgroundColor: accentColor }}
        >
          {isBoosting ? "🚀..." : "Boost"}
        </button>
      </div>

      {/* MODAL COMENTARIOS */}
      {showCommentModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="bg-gray-900 rounded-3xl p-6 w-full max-w-md border border-white/10">
            <h2 className="text-lg font-bold mb-3 text-white">Comentar</h2>
            <textarea
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              className="w-full bg-black border border-gray-700 rounded-xl p-3 min-h-[100px] text-white"
              placeholder="Escribe tu comentario..."
            />
            <div className="flex justify-end gap-3 mt-4">
              <button
                onClick={() => setShowCommentModal(false)}
                className="px-4 py-2 bg-gray-700 rounded-full"
              >
                Cancelar
              </button>
              <button
                onClick={handleComment}
                className="px-4 py-2 bg-purple-600 rounded-full"
              >
                Publicar
              </button>
            </div>
          </div>
        </div>
      )}
      {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
    </div>
  );
};

export default PostCard;
