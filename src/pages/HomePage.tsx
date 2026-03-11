// src/pages/HomePage.tsx
import React, { useEffect, useState, useRef, useCallback, useContext } from "react";
import { supabase } from "../supabaseClient";
import FeedPage from './FeedPage';
import { ThemeContext } from "../lib/ThemeContext";
import ProfileModal from "../components/ProfileModal";
import ActionButton from "../components/ActionButton";
import Inbox from "./chat/Inbox";

const PAGE_SIZE = 8;

const HomePage = ({ userId }: { userId: string | null }) => {
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showNewPostModal, setShowNewPostModal] = useState(false);
  const [newPostContent, setNewPostContent] = useState("");
  const [showInbox, setShowInbox] = useState(false);
  const { theme } = useContext(ThemeContext);

  const containerRef = useRef<HTMLDivElement>(null);

  const maxChars =
    profile?.tier === "premium+"
      ? 10000
      : profile?.tier === "premium"
      ? 4000
      : 280;

  const fetchPosts = useCallback(async (reset = false) => {
    if (!hasMore && !reset) return;

    try {
      setLoading(true);

      const from = reset ? 0 : page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      const { data, error } = await supabase
        .from("posts")
        .select("*")
        .order("timestamp", { ascending: false })
        .range(from, to);

      if (error) throw error;

      const newPosts = data || [];

      setPosts((prev) => (reset ? newPosts : [...prev, ...newPosts]));

      setHasMore(newPosts.length === PAGE_SIZE);

      if (reset) setPage(1);
      else setPage((prev) => prev + 1);
    } catch (err: any) {
      console.error("Error fetching posts:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [page, hasMore]);

  useEffect(() => {
    console.log("[HOME] userId recibido:", userId);

    if (userId) {
      const fetchProfile = async () => {
        const { data, error } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", userId)
          .maybeSingle();

        if (error) {
          console.error("[HOME] Error fetching profile:", error);
          setError("No se pudo cargar tu perfil");
          setProfile(null);
        } else {
          setProfile(data || null);
        }
      };

      fetchProfile();
    }

    fetchPosts(true);
  }, [userId, fetchPosts]);

  useEffect(() => {
    const handleScroll = () => {
      if (!containerRef.current) return;

      const { scrollTop, scrollHeight, clientHeight } = containerRef.current;

      if (scrollTop + clientHeight >= scrollHeight - 100) {
        fetchPosts();
      }
    };

    containerRef.current?.addEventListener("scroll", handleScroll);

    return () =>
      containerRef.current?.removeEventListener("scroll", handleScroll);
  }, [fetchPosts]);

  const handleRefresh = () => fetchPosts(true);

  const handleCreatePost = async () => {
    if (!newPostContent.trim()) {
      alert("Escribe algo antes de publicar");
      return;
    }

    if (!userId) {
      alert("No se encontró tu ID.");
      return;
    }

    try {
      const { error: insertError } = await supabase
        .from("posts")
        .insert({
          user_id: userId,
          content: newPostContent.trim(),
          timestamp: new Date().toISOString(),
          deleted_flag: false,
          visibility_score: 1
        });

      if (insertError) throw insertError;

      alert("¡Post publicado!");
      setShowNewPostModal(false);
      setNewPostContent("");
      fetchPosts(true);

    } catch (err: any) {
      console.error("[POST] Error:", err);
      alert("Error al publicar: " + err.message);
    }
  };

  return (
    <div
      ref={containerRef}
      className={`min-h-screen overflow-y-auto antialiased ${
        theme === "dark"
          ? "bg-black text-white"
          : "bg-white text-black"
      }`}
      style={{ overflowX: "hidden" }}
    >

      {/* HEADER */}
      <header className="sticky top-0 z-20 w-full px-4 py-3 flex items-center justify-between border-b border-white/10 bg-black/90 backdrop-blur-xl">

        <img
          src="/logo.png"
          alt="Humans"
          className="w-11 h-11 object-contain"
        />

        <div className="flex gap-3">

          <ActionButton
            label="Post"
            onClick={() => setShowNewPostModal(true)}
            className="px-5 py-2 bg-gray-800 rounded-full"
          />

          <button
            onClick={() => setShowInbox(true)}
            className="px-5 py-2 bg-indigo-700 rounded-full"
          >
            Mensajes
          </button>

        </div>

        <div
          className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center cursor-pointer"
          onClick={() => setShowProfileModal(true)}
        >
          H
        </div>

      </header>

      {/* FEED */}
      <main className="w-full px-2 py-6 flex justify-center">
        <FeedPage
          posts={posts}
          loading={loading}
          error={error}
          currentUserId={userId}
          userTier={profile?.tier || "free"}
        />
      </main>

      {/* MODAL NUEVO POST */}
      {showNewPostModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="bg-gray-900 rounded-2xl p-6 w-full max-w-lg">

            <h2 className="text-xl font-bold mb-4">Nuevo Post</h2>

            <textarea
              value={newPostContent}
              onChange={(e) => setNewPostContent(e.target.value)}
              className="w-full bg-black border border-gray-700 rounded-xl p-4 min-h-[140px]"
              maxLength={maxChars}
            />

            <div className="flex justify-between mt-4">

              <button
                onClick={() => setShowNewPostModal(false)}
                className="px-5 py-2 bg-gray-800 rounded-full"
              >
                Cancelar
              </button>

              <button
                onClick={handleCreatePost}
                className="px-6 py-2 bg-purple-600 rounded-full"
              >
                Publicar
              </button>

            </div>

          </div>
        </div>
      )}

      {/* MODAL PERFIL */}
      {showProfileModal && (
        <ProfileModal
          id={userId}
          currentUserId={userId}
          onClose={() => setShowProfileModal(false)}
          showUpgradeButton={profile?.tier === "free"}
        />
      )}

      {/* MODAL INBOX */}
      {showInbox && userId && (
        <Inbox
          currentUserId={userId}
          onClose={() => setShowInbox(false)}
        />
      )}

    </div>
  );
};

export default HomePage;
