import React, { useState, useEffect, useContext } from "react";
import { supabase } from "../supabaseClient";
import { useUserBalance } from "../lib/useUserBalance";
import { useFollow } from "../lib/useFollow";
import { ThemeContext } from "../lib/ThemeContext";

interface PostCardProps {
  post: any;
  currentUserId: string | null;
}

const PostCard: React.FC<PostCardProps> = ({ post, currentUserId }) => {
  const { balance } = useUserBalance(currentUserId);
  const { theme, accentColor } = useContext(ThemeContext);
  const { isFollowing, toggleFollow, loading: followLoading } = useFollow(
    currentUserId,
    post.user_id
  );

  const [liked, setLiked] = useState(false);
  const [likes, setLikes] = useState<number>(post.likes || 0);
  const [reposts, setReposts] = useState<number>(post.reposts || 0);
  const [commentsCount, setCommentsCount] = useState<number>(post.comments || 0);
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [tipAmount, setTipAmount] = useState<number | "">("");

  const [editing, setEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(post.content);

  // Verificar si el usuario ya dio like
  useEffect(() => {
    const checkLike = async () => {
      if (!currentUserId) return;
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

  // Timestamp relativo
  const getRelativeTime = (timestamp: string) => {
    const now = new Date();
    const postDate = new Date(timestamp);
    const diffMs = now.getTime() - postDate.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 60) return `${diffSec}s`;
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m`;
    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return `${diffHour}h`;
    const diffDay = Math.floor(diffHour / 24);
    if (diffDay < 7) return `${diffDay}d`;
    return postDate.toLocaleDateString();
  };

  // Like
  const handleLike = async () => {
    if (!currentUserId) return;
    if (liked) {
      await supabase
        .from("likes")
        .delete()
        .eq("post_id", post.id)
        .eq("user_id", currentUserId);
      setLikes((prev) => prev - 1);
      setLiked(false);
    } else {
      await supabase.from("likes").insert({ post_id: post.id, user_id: currentUserId });
      setLikes((prev) => prev + 1);
      setLiked(true);
      await supabase.from("notifications").insert({
        user_id: post.user_id,
        from_user: currentUserId,
        type: "like",
        post_id: post.id,
      });
    }
  };

  // Repost
  const handleRepost = async () => {
    if (!currentUserId) return;
    await supabase.from("reposts").insert({ post_id: post.id, user_id: currentUserId });
    setReposts((prev) => prev + 1);
    await supabase.from("notifications").insert({
      user_id: post.user_id,
      from_user: currentUserId,
      type: "repost",
      post_id: post.id,
    });
    alert("Repost enviado");
  };

  // Comentario
  const handleComment = async () => {
    if (!currentUserId || !commentText.trim()) return;
    await supabase.from("comments").insert({
      post_id: post.id,
      user_id: currentUserId,
      content: commentText.trim(),
    });
    await supabase.from("notifications").insert({
      user_id: post.user_id,
      from_user: currentUserId,
      type: "comment",
      post_id: post.id,
    });
    setCommentText("");
    setShowCommentModal(false);
    setCommentsCount((prev) => prev + 1);
  };

  // Tip
  const handleTip = async () => {
    if (!currentUserId || !tipAmount || tipAmount <= 0) return alert("Ingresa un tip válido");
    if (tipAmount > balance) return alert("No tienes suficiente WLD");
    await supabase.rpc("transfer_tip", {
      from_user_id: currentUserId,
      to_user_id: post.user_id,
      tip_amount: tipAmount,
    });
    await supabase.from("notifications").insert({
      user_id: post.user_id,
      from_user: currentUserId,
      type: "tip",
      post_id: post.id,
    });
    alert(`Tip enviado: ${tipAmount} WLD`);
    setTipAmount("");
  };

  // Boost
  const handleBoost = async () => {
    const boostCost = 5;
    if (!currentUserId || balance < boostCost) return alert("No tienes suficiente WLD");
    await supabase.from("user_balances").update({ wld_balance: balance - boostCost }).eq("user_id", currentUserId);
    alert("Post potenciado 🚀");
  };

  // Editar post (solo el propietario)
  const handleEdit = async () => {
    if (!currentUserId || currentUserId !== post.user_id) return;
    await supabase.from("posts").update({ content: editedContent, edited_at: new Date().toISOString() }).eq("id", post.id);
    setEditing(false);
  };

  return (
    <div
      className={`p-4 rounded-3xl border shadow-lg space-y-3 transition hover:scale-[1.02] hover:shadow-2xl ${
        theme === "dark" ? "bg-gray-900 text-white border-white/20" : "bg-white text-black border-gray-200"
      }`}
      style={{ borderColor: accentColor }}
    >
      {/* HEADER */}
      <div className="flex justify-between items-start">
        <div className="flex gap-3">
          <img
            src={post.profile?.avatar_url || "/default-avatar.png"}
            alt={post.profile?.username || "User"}
            className="w-12 h-12 rounded-full object-cover ring-1 ring-gray-400"
          />
          <div className="flex flex-col">
            <span className="font-bold text-sm flex items-center gap-1">
              {post.profile?.username || "Anon"}
              {post.profile?.tier && post.profile.tier !== "free" && (
                <span className="text-xs px-1 rounded bg-purple-600 text-white">{post.profile.tier.toUpperCase()}</span>
              )}
              {post.is_exclusive && (
                <span className="text-xs px-1 rounded bg-yellow-500 text-black">EXCLUSIVO</span>
              )}
            </span>
            <span className="text-xs text-gray-400">
              {getRelativeTime(post.timestamp)}
              {post.edited_at ? " • editado" : ""}
            </span>
          </div>
        </div>
        {currentUserId && currentUserId !== post.user_id && (
          <button
            onClick={toggleFollow}
            disabled={followLoading}
            className="px-3 py-1 rounded-full text-xs font-semibold"
            style={{ backgroundColor: isFollowing ? "#444" : accentColor, color: "white" }}
          >
            {followLoading ? "..." : isFollowing ? "Siguiendo" : "Seguir"}
          </button>
        )}
      </div>

      {/* CONTENIDO */}
      {editing && currentUserId === post.user_id ? (
        <textarea
          value={editedContent}
          onChange={(e) => setEditedContent(e.target.value)}
          className="w-full bg-gray-100 dark:bg-gray-800 p-3 rounded-xl text-black dark:text-white border border-gray-300 dark:border-gray-700"
        />
      ) : (
        <div className="text-sm leading-relaxed whitespace-pre-wrap">{post.content}</div>
      )}
      {editing && currentUserId === post.user_id && (
        <div className="flex justify-end gap-2 mt-2">
          <button className="px-3 py-1 bg-gray-400 rounded-full text-sm" onClick={() => setEditing(false)}>
            Cancelar
          </button>
          <button className="px-3 py-1 bg-purple-600 rounded-full text-sm text-white" onClick={handleEdit}>
            Guardar
          </button>
        </div>
      )}

      {/* ACCIONES */}
      <div className="flex gap-4 pt-2 text-sm text-gray-500">
        <button className="flex items-center gap-1 transition hover:text-red-500" onClick={handleLike}>
          {liked ? "❤️" : "🤍"} {likes}
        </button>
        <button className="flex items-center gap-1 transition hover:text-blue-500" onClick={() => setShowCommentModal(true)}>
          💬 {commentsCount}
        </button>
        <button className="flex items-center gap-1 transition hover:text-green-500" onClick={handleRepost}>
          🔁 {reposts}
        </button>
      </div>

      {/* TIP + BOOST */}
      <div className="flex gap-2 pt-2">
        <input
          type="number"
          step={0.1}
          value={tipAmount}
          onChange={(e) => setTipAmount(e.target.value ? parseFloat(e.target.value) : "")}
          className="w-20 px-2 py-1 rounded border border-gray-300"
          placeholder="Tip"
        />
        <button onClick={handleTip} className="px-3 py-1 rounded text-white font-medium" style={{ backgroundColor: accentColor }}>
          Tip
        </button>
        <button onClick={handleBoost} className="px-3 py-1 rounded text-white font-medium" style={{ backgroundColor: accentColor }}>
          Boost
        </button>
      </div>

      {/* MODAL COMENTARIOS */}
      {showCommentModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="bg-gray-900 rounded-2xl p-6 w-full max-w-md border border-white/10">
            <h2 className="text-lg font-bold mb-3">Comentar</h2>
            <textarea
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              className="w-full bg-black border border-gray-700 rounded-xl p-3 min-h-[100px] text-white"
              placeholder="Escribe tu comentario..."
            />
            <div className="flex justify-end gap-3 mt-4">
              <button onClick={() => setShowCommentModal(false)} className="px-4 py-2 bg-gray-700 rounded-full">
                Cancelar
              </button>
              <button onClick={handleComment} className="px-4 py-2 bg-purple-600 rounded-full">
                Publicar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PostCard;
