import React, { useState, useEffect, useContext } from "react";
import { supabase } from "../supabaseClient";
import { ThemeContext } from "../lib/ThemeContext";
import { useFollow } from "../lib/useFollow";
import { MiniKit, Tokens, tokenToDecimals } from "@worldcoin/minikit-js";

interface PostCardProps {
  post: any;
  currentUserId: string | null;
}

const RECEIVER = "0xdf4a991bc05945bd0212e773adcff6ea619f4c4b";

const PostCard: React.FC<PostCardProps> = ({ post, currentUserId }) => {
  const { theme } = useContext(ThemeContext);

  const [liked, setLiked] = useState(false);
  const [likes, setLikes] = useState(post.likes || 0);
  const [comments, setComments] = useState(post.comments || 0);
  const [reposts, setReposts] = useState(post.reposts || 0);
  const [commentInput, setCommentInput] = useState("");
  const [showCommentInput, setShowCommentInput] = useState(false);
  const [loadingAction, setLoadingAction] = useState<"like" | "comment" | "repost" | "tip" | "boost" | "follow" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { isFollowing, toggleFollow } = useFollow(currentUserId, post.user_id);

  // NUEVOS STATES para comentarios
  const [showComments, setShowComments] = useState(false);
  const [commentsList, setCommentsList] = useState<any[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);

  // Real-time para likes, comments, reposts
  useEffect(() => {
    if (!post.id) return;

    const channel = supabase
      .channel(`post-${post.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "posts", filter: `id=eq.${post.id}` },
        (payload) => {
          if (payload.new.likes !== likes) setLikes(payload.new.likes);
          if (payload.new.comments !== comments) setComments(payload.new.comments);
          if (payload.new.reposts !== reposts) setReposts(payload.new.reposts);
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [post.id, likes, comments, reposts]);

  // NUEVO: fetch de comentarios cuando se abre la lista
  useEffect(() => {
    if (showComments && post.id) {
      const fetchComments = async () => {
        setLoadingComments(true);
        try {
          const { data, error } = await supabase
            .from("comments")
            .select(`
              *,
              profiles (
                id,
                username,
                avatar_url
              )
            `)
            .eq("post_id", post.id)
            .order("timestamp", { ascending: false })
            .limit(10);

          if (error) throw error;
          setCommentsList(data || []);
        } catch (err: any) {
          console.error("Error cargando comentarios:", err);
        } finally {
          setLoadingComments(false);
        }
      };

      fetchComments();
    }
  }, [showComments, post.id]);

  // NUEVO handleLike con tabla intermedia likes
  const handleLike = async () => {
    if (!currentUserId) return setError("Debes estar logueado");
    setLoadingAction("like");

    try {
      const { data: existingLike } = await supabase
        .from("likes")
        .select("id")
        .eq("post_id", post.id)
        .eq("user_id", currentUserId)
        .maybeSingle();

      if (existingLike) {
        // Quitar like
        await supabase.from("likes").delete().eq("id", existingLike.id);
        await supabase.from("posts").update({ likes: likes - 1 }).eq("id", post.id);
        setLiked(false);
        setLikes(likes - 1);
      } else {
        // Dar like
        await supabase.from("likes").insert({ post_id: post.id, user_id: currentUserId });
        await supabase.from("posts").update({ likes: likes + 1 }).eq("id", post.id);
        setLiked(true);
        setLikes(likes + 1);
      }
    } catch (err: any) {
      setError("Error al dar like: " + err.message);
    } finally {
      setLoadingAction(null);
    }
  };

  const handleComment = async () => {
    if (!currentUserId) return setError("Debes estar logueado");
    if (!commentInput.trim()) return setError("Escribe un comentario");

    setLoadingAction("comment");

    try {
      await supabase.from("comments").insert({
        post_id: post.id,
        user_id: currentUserId,
        content: commentInput.trim(),
        timestamp: new Date().toISOString(),
      });

      await supabase.from("posts").update({ comments: comments + 1 }).eq("id", post.id);

      setCommentInput("");
      setShowCommentInput(false);
      setComments(comments + 1);
    } catch (err: any) {
      setError("Error al comentar: " + err.message);
    } finally {
      setLoadingAction(null);
    }
  };

  const handleRepost = async () => {
    if (!currentUserId) return setError("Debes estar logueado");
    if (!confirm("¿Repostear este post?")) return;

    setLoadingAction("repost");

    try {
      await supabase.from("reposts").insert({
        post_id: post.id,
        user_id: currentUserId,
        timestamp: new Date().toISOString(),
      });

      await supabase.from("posts").update({ reposts: reposts + 1 }).eq("id", post.id);
      setReposts(reposts + 1);
    } catch (err: any) {
      setError("Error al repostear: " + err.message);
    } finally {
      setLoadingAction(null);
    }
  };

  const handleTip = async () => {
    if (!currentUserId) return setError("Debes estar logueado");
    if (!confirm("¿Enviar 1 WLD como tip?")) return;

    setLoadingAction("tip");

    try {
      const payRes = await MiniKit.commandsAsync.pay({
        amount: 1,
        currency: "WLD",
        recipient: RECEIVER,
      });

      if (payRes.status !== "success") throw new Error("Pago fallido");

      alert("¡Tip enviado!");
    } catch (err: any) {
      setError("Error en tip: " + err.message);
    } finally {
      setLoadingAction(null);
    }
  };

  const handleBoost = async () => {
    if (!currentUserId) return setError("Debes estar logueado");
    if (!confirm("¿Enviar 5 WLD como boost?")) return;

    setLoadingAction("boost");

    try {
      const payRes = await MiniKit.commandsAsync.pay({
        amount: 5,
        currency: "WLD",
        recipient: RECEIVER,
      });

      if (payRes.status !== "success") throw new Error("Pago fallido");

      alert("¡Boost enviado!");
    } catch (err: any) {
      setError("Error en boost: " + err.message);
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <div className={`p-4 rounded-xl ${theme === "dark" ? "bg-gray-900" : "bg-gray-100"} border border-gray-700 mb-4 shadow-md`}>
      {/* …todo tu código existente para avatar, contenido y botones de acción … */}

      {/* Input comentario */}
      {showCommentInput && (
        <div className="mt-4 flex gap-2">
          <input
            type="text"
            value={commentInput}
            onChange={(e) => setCommentInput(e.target.value)}
            placeholder="Escribe un comentario..."
            className="flex-1 bg-gray-800 p-2 rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
          <button
            onClick={handleComment}
            disabled={loadingAction === "comment" || !commentInput.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded text-sm disabled:opacity-50"
          >
            {loadingAction === "comment" ? "..." : "Enviar"}
          </button>
        </div>
      )}

      {/* Lista de comentarios */}
      {comments > 0 && (
        <div className="mt-4">
          <button
            onClick={() => setShowComments(!showComments)}
            className="text-blue-400 hover:text-blue-300 text-sm"
          >
            {showComments ? "Ocultar" : "Ver"} {comments} comentario{comments !== 1 ? "s" : ""}
          </button>

          {showComments && (
            <div className="mt-2 space-y-3 max-h-60 overflow-y-auto">
              {loadingComments ? (
                <p className="text-gray-500 text-sm">Cargando comentarios...</p>
              ) : commentsList.length === 0 ? (
                <p className="text-gray-500 text-sm">No hay comentarios aún</p>
              ) : (
                commentsList.map((c) => (
                  <div key={c.id} className="bg-gray-800 p-3 rounded text-sm">
                    <p className="font-bold">
                      {c.profiles?.username || `@anon-${c.user_id.slice(0,8)}`}
                    </p>
                    <p className="text-gray-300">{c.content}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {new Date(c.timestamp).toLocaleString()}
                    </p>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {/* Error */}
      {error && <p className="text-red-500 text-sm mt-3">{error}</p>}
    </div>
  );
};

export default PostCard;
