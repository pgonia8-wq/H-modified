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

  useEffect(() => {
    if (!currentUserId) return;

    loadConversations();
    loadMatches();
  }, [currentUserId]);

  /* ----------------------------------------
     Cargar conversaciones
  ---------------------------------------- */

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
      console.error("[INBOX] Error cargando conversaciones:", err.message);
    } finally {
      setLoading(false);
    }
  };

  /* ----------------------------------------
     Contador de mensajes no leídos
  ---------------------------------------- */

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

  /* ----------------------------------------
     Cargar matches (mutual follows)
  ---------------------------------------- */

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

      const matches = followingIds.filter(id => followerIds.includes(id));

      setMatchIds(matches);
      setNewMatches(matches);

    } catch (err: any) {
      console.error("[INBOX] Error cargando matches:", err.message);
    }
  };

  /* ----------------------------------------
     Cargar perfiles
  ---------------------------------------- */

  const loadProfiles = async (ids: string[]) => {

    const toLoad = ids.filter(id => !profilesCache[id]);

    if (toLoad.length === 0) return;

    try {
      const { data } = await supabase
        .from("profiles")
        .select("id,name,username,avatar_url")
        .in("id", toLoad);

      if (data) {

        const newCache = { ...profilesCache };

        data.forEach(p => {
          newCache[p.id] = p;
        });

        setProfilesCache(newCache);
      }

    } catch (err: any) {
      console.error("[INBOX] Error cargando perfiles:", err.message);
    }
  };

  /* ----------------------------------------
     Buscar usuarios (solo matches)
  ---------------------------------------- */

  const handleSearch = async (query: string) => {

    setSearchQuery(query);

    if (!currentUserId || !query.trim()) {
      setSearchResults([]);
      return;
    }

    try {

      const { data, error } = await supabase
        .from("profiles")
        .select("id,name,username,avatar_url")
        .ilike("username", `%${query}%`)
        .limit(10);

      if (error) throw error;

      const filtered = (data || []).filter(u =>
        matchIds.includes(u.id)
      );

      setSearchResults(filtered);

      const newCache = { ...profilesCache };

      filtered.forEach(u => {
        newCache[u.id] = u;
      });

      setProfilesCache(newCache);

    } catch (err: any) {

      console.error("[INBOX] Error buscando usuarios:", err.message);
      setSearchResults([]);
    }
  };

  /* ----------------------------------------
     Render perfil
  ---------------------------------------- */

  const renderProfile = (id: string) => {

    const p = profilesCache[id];

    return (

      <div className="flex items-center gap-2">

        <div className="w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center text-white overflow-hidden">

          {p?.avatar_url ? (

            <img
              src={p.avatar_url}
              className="w-full h-full object-cover"
            />

          ) : (

            p?.name?.[0] || p?.username?.[0]

          )}

        </div>

        <div className="text-white text-sm">

          {p?.username || id.slice(0, 10)}

        </div>

        {newMatches.includes(id) && (

          <span className="ml-1 px-1.5 py-0.5 bg-green-500 text-xs rounded">
            nuevo
          </span>

        )}

      </div>
    );
  };

  /* ----------------------------------------
     Abrir ChatWindow
  ---------------------------------------- */

  if (chatUserId && currentUserId) {

    setNewMatches(prev => prev.filter(id => id !== chatUserId));

    return (

      <ChatWindow
        currentUserId={currentUserId}
        otherUserId={chatUserId}
        onBack={() => setChatUserId(null)}
      />

    );
  }

  /* ----------------------------------------
     UI
  ---------------------------------------- */

  if (!currentUserId) {

    return (

      <div className="p-4 text-gray-400 text-center">
        No hay usuario logueado
      </div>

    );
  }

  return (

    <div className="w-full h-full flex flex-col">

      {/* Header */}

      <div className="flex justify-between items-center mb-3">

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

      {/* Buscador */}

      <input
        type="text"
        value={searchQuery}
        onChange={(e) => handleSearch(e.target.value)}
        placeholder="Buscar seguidores..."
        className="w-full mb-3 p-2 rounded bg-gray-800 text-white focus:outline-none"
      />

      {/* Resultados búsqueda */}

      {searchResults.length > 0 && (

        <div className="mb-2 max-h-40 overflow-y-auto">

          {searchResults.map(u => (

            <div
              key={u.id}
              onClick={() => setChatUserId(u.id)}
              className="flex items-center p-2 cursor-pointer hover:bg-gray-700 rounded"
            >

              {renderProfile(u.id)}

            </div>

          ))}

        </div>

      )}

      {/* Conversaciones */}

      <div className="flex-1 overflow-y-auto">

        {loading ? (

          <p className="text-gray-400 text-center mt-4">
            Cargando conversaciones...
          </p>

        ) : conversations.length === 0 ? (

          <p className="text-gray-400 text-center mt-4">
            No hay conversaciones aún
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
                onClick={() => setChatUserId(otherId)}
                className="flex items-center justify-between p-2 bg-gray-800 rounded mb-1 cursor-pointer hover:bg-gray-700"
              >

                {renderProfile(otherId)}

                <div className="flex items-center gap-2">

                  {unread > 0 && (

                    <span className="bg-red-600 text-xs px-2 py-0.5 rounded-full text-white">
                      {unread}
                    </span>

                  )}

                  <div className="text-gray-400 text-sm">
                    {c.last_message}
                  </div>

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
