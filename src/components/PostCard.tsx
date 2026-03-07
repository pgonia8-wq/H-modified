import React, { useState, useEffect, useContext } from "react";
import { supabase } from "../supabaseClient";
import { ThemeContext } from "../lib/ThemeContext";
import { useFollow } from "../lib/useFollow";
import { useMiniKitUser } from "../lib/useMiniKitUser";

interface PostCardProps {
  post: any;
  currentUserId: string | null;
}

const PostCard: React.FC<PostCardProps> = ({ post, currentUserId }) => {
  const { theme } = useContext(ThemeContext);
  const { balance, sendWLD } = useMiniKitUser(currentUserId);

  const [liked, setLiked] = useState(false);
  const [likes, setLikes] = useState(post.likes || 0);
  const [reposts, setReposts] = useState(post.reposts || 0);
  const [comments, setComments] = useState(post.comments || 0);

  const [followers, setFollowers] = useState(post.profile?.followers_count || 0);
  const [following, setFollowing] = useState(post.profile?.following_count || 0);
  const { isFollowing, toggleFollow, loading: followLoading } = useFollow(
    currentUserId,
    post.user_id
  );

  useEffect(() => {
    if (!post.user_id) return;

    const fetchStats = async () => {
      try {
        const { data: profileData } = await supabase
          .from("profiles")
          .select("followers_count, following_count")
          .eq("id", post.user_id)
          .single();

        if (profileData) {
          setFollowers(profileData.followers_count || 0);
          setFollowing(profileData.following_count || 0);
        }
      } catch (err) {
        console.error("Error fetching followers/following:", err);
      }
    };

    fetchStats();
  }, [post.user_id]);

  // TIP + BOOST
  const [tipAmount, setTipAmount] = useState<number | "">("");
  const [isBoosting, setIsBoosting] = useState(false);
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const accentColor = "#7c3aed";

  const handleTip = async () => {
    if (!currentUserId || !post.user_id || !tipAmount || tipAmount < 1) {
      setError("Tip mínimo 1 WLD");
      return;
    }
    try {
      const creatorAmount = tipAmount * 0.9;
      const appAmount = tipAmount * 0.1;

      await sendWLD(post.user_id, creatorAmount); // 90% al creador
      await sendWLD("APP_WLD_ACCOUNT", appAmount); // 10% a la app (reemplaza ID real)

      alert(`Tip de ${tipAmount} WLD enviado (90% al creador, 10% a la app)`);
      setTipAmount("");
    } catch (err: any) {
      console.error("Error enviando tip:", err);
      setError(err.message || "Error enviando tip");
    }
  };

  const handleBoost = async () => {
    if (!currentUserId || !post.user_id) return;
    setIsBoosting(true);
    const boostAmount = 5; // WLD fijo

    try {
      await sendWLD(post.user_id, boostAmount); // envía WLD al creador
      // Lógica de boost: activa por 6 horas en DB
      await supabase
        .from("posts")
        .update({
          boosted_until: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
        })
        .eq("id", post.id);

      alert("Boost enviado 🚀 (dura 6 horas)");
    } catch (err: any) {
      console.error("Error en boost:", err);
      setError(err.message || "Error en boost");
    } finally {
      setIsBoosting(false);
    }
  };

  const handleComment = async () => {
    if (!commentText.trim() || !currentUserId) return;
    try {
      await supabase
        .from("comments")
        .insert({
          post_id: post.id,
          user_id: currentUserId,
          content: commentText,
          timestamp: new Date().toISOString(),
        });
      alert("Comentario publicado");
      setCommentText("");
      setShowCommentModal(false);
      setComments((prev) => prev + 1);
    } catch (err: any) {
      console.error("Error comentando:", err);
      setError(err.message || "Error publicando comentario");
    }
  };

  return (
    <div className="bg-gray-900/60 backdrop-blur-sm rounded-2xl p-4 space-y-4 border border-white/10">
      <div className="flex items-center gap-3">
        <img
          src={post.profile?.avatar_url || "default-avatar.png"}
          alt={post.profile?.username || "Anon"}
          className="w-10 h-10 rounded-full object-cover"
        />
        <div className="flex-1">
          <h3 className="font-bold text-white">
            {post.profile?.username || "Anon"} {post.profile?.is_premium && "✅"}
          </h3>
          <div className="text-gray-400 text-xs flex gap-3 mt-1">
            <span>Followers: {followers}</span>
            <span>Following: {following}</span>
          </div>
          {currentUserId && post.user_id !== currentUserId && (
            <button
              onClick={async () => {
                await toggleFollow();
                setFollowers((prev) => (isFollowing ? prev - 1 : prev + 1));
              }}
              disabled={followLoading}
              className="mt-1 px-3 py-1 rounded bg-purple-600 text-white text-xs hover:bg-purple-700 transition"
            >
              {isFollowing ? "Siguiendo" : "Seguir"}
            </button>
          )}
        </div>
      </div>

      <p className="text-white whitespace-pre-wrap">{post.content}</p>

      <div className="flex gap-4 text-gray-400 text-sm">
        <button onClick={() => setLiked(!liked)}>
          {liked ? "❤️" : "♡"} {likes}
        </button>
        <button>💬 {comments}</button>
        <button>🔁 {reposts}</button>
      </div>

      <div className="flex flex-wrap gap-2 pt-3 items-center">
        <input
          type="number"
          step={0.1}
          min={1}
          max={balance}
          value={tipAmount}
          onChange={(e) =>
            setTipAmount(e.target.value ? parseFloat(e.target.value) : "")
          }
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

      {showCommentModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="bg-gray-900 rounded-3xl p-6 w-full max-w-md border border-white/10">
            <h2 className="text-lg font-bold mb-3 text-white">Comentar</h2>
            <textarea
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              className="w-full bg-black border border-gray-700 rounded-xl p-3 min-h-[100px] text-white"
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
