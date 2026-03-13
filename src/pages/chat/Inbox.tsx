import React, { useEffect, useState } from "react";
import { supabase } from "../../supabaseClient";
import ChatWindow from "./ChatWindow";

interface InboxProps {
  currentUserId: string | null;
  onClose: () => void;
}

interface Conversation {
  id: string;
  user1_id: string;
  user2_id: string;
  last_message: string | null;
  last_message_time: string | null;
}

interface Profile {
  id: string;
  name: string;
  username: string;
  avatar_url?: string;
}

const Inbox: React.FC<InboxProps> = ({ currentUserId, onClose }) => {

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Profile[]>([]);

  const [matchIds, setMatchIds] = useState<string[]>([]);
  const [profilesCache, setProfilesCache] = useState<Record<string, Profile>>({});
  const [newMatches, setNewMatches] = useState<string[]>([]);

  const [chatUserId, setChatUserId] = useState<string | null>(null);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});

  /* ------------------------------
     Carga inicial
  ------------------------------ */

  useEffect(() => {

    if (!currentUserId) return;

    loadConversations();
    loadMatches();

  }, [currentUserId]);

  /* ------------------------------
     Realtime Inbox
  ------------------------------ */

  useEffect(() => {

    if (!currentUserId) return;

    const channel = supabase
      .channel("inbox-realtime")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages"
        },
        (payload) => {

          const msg = payload.new as any;

          if (
            msg.receiver_id === currentUserId ||
            msg.sender_id === currentUserId
          ) {
            loadConversations();
          }

        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };

  }, [currentUserId]);

  /* ------------------------------
     Cargar conversaciones
  ------------------------------ */

  const loadConversations = async () => {

    if (!currentUserId) return;

    setLoading(true);

    try {

      const { data, error } = await supabase
        .from("conversations_with_last_message")
        .select("*")
        .or(`user1_id.eq.${currentUserId},user2_id.eq.${currentUserId}`)
        .order("last_message_time", { ascending: false });

      if (error) throw error;

      const convs = data || [];

      setConversations(convs);

      const otherIds = convs.map(c =>
        c.user1_id === currentUserId ? c.user2_id : c.user1_id
      );

      await loadProfiles(otherIds);
      await loadUnreadCounts(convs);

    } catch (err: any) {

      console.error("[INBOX]", err.message);

    } finally {

      setLoading(false);

    }

  };

  /* ------------------------------
     Contador no leídos
  ------------------------------ */

  const loadUnreadCounts = async (convs: Conversation[]) => {

    if (!currentUserId) return;

    const counts: Record<string, number> = {};

    for (const c of convs) {

      const conversationId =
        [c.user1_id, c.user2_id].sort().join("-");

      const { count } = await supabase
        .from("messages")
        .select("*", { count: "exact", head: true })
        .eq("conversation_id", conversationId)
        .eq("receiver_id", currentUserId)
        .eq("read_flag", false);

      counts[conversationId] = count || 0;

    }

    setUnreadCounts(counts);

  };

  /* ------------------------------
     Cargar matches
  ------------------------------ */

  const loadMatches = async () => {

    if (!currentUserId) return;

    try {

      const { data: following } = await supabase
        .from("follows")
        .select("following_id")
        .eq("follower_id", currentUserId);

      const { data: followers } = await supabase
        .from("follows")
        .select("follower_id")
        .eq("following_id", currentUserId);

      const followingIds = following?.map(f => f.following_id) || [];
      const followerIds = followers?.map(f => f.follower_id) || [];

      const matches = followingIds.filter(id =>
        followerIds.includes(id)
      );

      setMatchIds(matches);
      setNewMatches(matches);

    } catch (err: any) {

      console.error("[INBOX MATCHES]", err.message);

    }

  };

  /* ------------------------------
     Cargar perfiles
  ------------------------------ */

  const loadProfiles = async (ids: string[]) => {

    const toLoad = ids.filter(id => !profilesCache[id]);

    if (toLoad.length === 0) return;

    const { data } = await supabase
      .from("profiles")
      .select("id,name,username,avatar_url")
      .in("id", toLoad);

    if (data) {

      setProfilesCache(prev => {

        const newCache = { ...prev };

        data.forEach(p => {
          newCache[p.id] = p;
        });

        return newCache;

      });

    }

  };

  /* ------------------------------
     Buscar usuarios
  ------------------------------ */

  const handleSearch = async (query: string) => {

    setSearchQuery(query);

    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    const { data } = await supabase
      .from("profiles")
      .select("id,name,username,avatar_url")
      .ilike("username", `%${query}%`)
      .limit(10);

    const filtered = (data || []).filter(u =>
      matchIds.includes(u.id)
    );

    setSearchResults(filtered);

  };

  /* ------------------------------
     Abrir chat
  ------------------------------ */

  const openChat = (userId: string) => {

    setChatUserId(userId);
    setNewMatches(prev => prev.filter(id => id !== userId));

  };

  /* ------------------------------
     Render perfil
  ------------------------------ */

  const renderProfile = (id: string) => {

    const p = profilesCache[id];

    return (

      <div className="flex items-center gap-2">

        <div className="w-8 h-8 rounded-full bg-gray-600 overflow-hidden flex items-center justify-center text-white">

          {p?.avatar_url ? (

            <img
              src={p.avatar_url}
              alt="avatar"
              className="w-full h-full object-cover"
            />

          ) : (

            p?.username?.[0]

          )}

        </div>

        <div className="text-white text-sm">
          {p?.username || id.slice(0, 8)}
        </div>

        {newMatches.includes(id) && (
          <span className="text-xs bg-green-500 px-1 rounded">
            nuevo
          </span>
        )}

      </div>

    );

  };

  /* ------------------------------
     Abrir ChatWindow
  ------------------------------ */

  if (chatUserId && currentUserId) {

    return (

      <ChatWindow
        currentUserId={currentUserId}
        otherUserId={chatUserId}
        onBack={() => setChatUserId(null)}
      />

    );

  }

  /* ------------------------------
     UI
  ------------------------------ */

  return (

    <div className="w-full h-full flex flex-col">

      <div className="flex justify-between mb-3">

        <h2 className="text-white font-bold text-lg">
          Mensajes
        </h2>

        <button
          onClick={onClose}
          className="text-gray-400 hover:text-white"
        >
          Cerrar
        </button>

      </div>

      <input
        value={searchQuery}
        onChange={(e) => handleSearch(e.target.value)}
        placeholder="Buscar seguidores..."
        className="p-2 mb-3 rounded bg-gray-800 text-white"
      />

      {searchResults.map(u => (

        <div
          key={u.id}
          onClick={() => openChat(u.id)}
          className="p-2 hover:bg-gray-700 rounded cursor-pointer"
        >

          {renderProfile(u.id)}

        </div>

      ))}

      <div className="flex-1 overflow-y-auto">

        {loading ? (

          <p className="text-gray-400 text-center mt-4">
            Cargando...
          </p>

        ) : (

          conversations.map(c => {

            const otherId =
              c.user1_id === currentUserId
                ? c.user2_id
                : c.user1_id;

            const conversationId =
              [c.user1_id, c.user2_id].sort().join("-");

            const unread = unreadCounts[conversationId] || 0;

            return (

              <div
                key={c.id}
                onClick={() => openChat(otherId)}
                className="flex justify-between p-2 bg-gray-800 rounded mb-1 hover:bg-gray-700 cursor-pointer"
              >

                {renderProfile(otherId)}

                <div className="flex gap-2 items-center">

                  {unread > 0 && (
                    <span className="bg-red-600 text-xs px-2 rounded-full">
                      {unread}
                    </span>
                  )}

                  <span className="text-gray-400 text-sm">
                    {c.last_message}
                  </span>

                </div>

              </div>

            );

          })

        )}

      </div>

    </div>

  );

};

export default Inbox;
