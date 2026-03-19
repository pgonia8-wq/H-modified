import React, { useEffect, useRef, useState } from "react";
import { supabase } from "../../supabaseClient";

interface GlobalChatRoomProps {
  currentUserId: string;
  roomId?: string;
  onClose: () => void;
}

interface ChatMessage {
  id: string;
  sender_id: string;
  sender_name?: string; // nombre completo opcional
  sender_avatar?: string; // url del avatar opcional
  content: string;
}

const GlobalChatRoom: React.FC<GlobalChatRoomProps> = ({
  currentUserId,
  roomId = "premium_global_chat",
  onClose,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [goldMessages, setGoldMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [typing, setTyping] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [goldSubscribed, setGoldSubscribed] = useState(false);
  const [showGoldChat, setShowGoldChat] = useState(false);
  const [usersConnected, setUsersConnected] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);

  const defaultAvatar =
    "https://i.pravatar.cc/40?u="; // placeholder para usuarios sin avatar

  // --- Load Classic Messages ---
  useEffect(() => {
    const loadMessages = async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const { data, error } = await supabase
          .from("global_chat_messages")
          .select("*")
          .eq("room_id", roomId)
          .order("created_at", { ascending: true })
          .limit(50);
        if (error) setLoadError(error.message);
        else setMessages(data || []);
      } catch (err: any) {
        setLoadError(err.message || "Error desconocido");
      } finally {
        setLoading(false);
      }
    };
    loadMessages();
  }, [roomId]);

  // --- Load Gold Messages ---
  useEffect(() => {
    if (!goldSubscribed || !showGoldChat) return;
    const loadGoldMessages = async () => {
      try {
        const { data } = await supabase
          .from("gold_chat_messages")
          .select("*")
          .order("created_at", { ascending: true })
          .limit(50);
        setGoldMessages(data || []);
      } catch (err) {
        console.error("Error cargando Gold Chat:", err);
      }
    };
    loadGoldMessages();
  }, [goldSubscribed, showGoldChat]);

  // --- Realtime Classic Chat ---
  useEffect(() => {
    const channel = supabase.channel(`global-chat-${roomId}`);
    channel
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "global_chat_messages", filter: `room_id=eq.${roomId}` },
        (payload) => setMessages((prev) => [...prev, payload.new])
      )
      .on("broadcast", { event: "typing" }, (payload) => {
        if (payload.payload.user !== currentUserId) {
          setTyping(true);
          setTimeout(() => setTyping(false), 2000);
        }
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [currentUserId, roomId]);

  // --- Realtime Gold Chat ---
  useEffect(() => {
    if (!goldSubscribed || !showGoldChat) return;
    const channel = supabase.channel(`gold-chat`);
    channel
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "gold_chat_messages" },
        (payload) => setGoldMessages((prev) => [...prev, payload.new])
      )
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [goldSubscribed, showGoldChat]);

  // --- Auto scroll ---
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, goldMessages, showGoldChat]);

  const sendTyping = async () => {
    const channel = supabase.channel(`global-chat-${roomId}`);
    await channel.send({ type: "broadcast", event: "typing", payload: { user: currentUserId } });
  };

  const sendMessage = async () => {
    if (!newMessage.trim()) return;
    const table = showGoldChat ? "gold_chat_messages" : "global_chat_messages";
    const payload: any = showGoldChat
      ? { sender_id: currentUserId, content: newMessage.trim() }
      : { sender_id: currentUserId, room_id: roomId, content: newMessage.trim() };
    const { error } = await supabase.from(table).insert(payload);
    if (!error) setNewMessage("");
  };

  const handleGoldSubscribe = () => {
    setGoldSubscribed(true);
    setShowGoldChat(true);
  };

  // Simula usuarios conectados (puedes reemplazar con realtime)
  useEffect(() => {
    const interval = setInterval(() => setUsersConnected(Math.floor(Math.random() * 10) + 1), 5000);
    return () => clearInterval(interval);
  }, []);

  const renderMessage = (m: ChatMessage) => {
    const isCurrentUser = m.sender_id === currentUserId;
    const alignment = isCurrentUser ? "justify-end" : "justify-start";
    const bgColor = isCurrentUser ? "bg-purple-600 text-white" : "bg-gray-700 text-gray-200";
    const avatarUrl = m.sender_avatar || `${defaultAvatar}${m.sender_id}`;
    const username = m.sender_name || m.sender_id;

    return (
      <div key={m.id || Math.random()} className={`flex items-start gap-2 ${alignment}`}>
        {!isCurrentUser && <img src={avatarUrl} alt={username} className="w-8 h-8 rounded-full object-cover" />}
        <div className={`max-w-[70%] px-4 py-2 rounded-2xl ${bgColor}`}>
          <span className="text-xs opacity-70 block mb-1">{username}</span>
          {m.content}
        </div>
        {isCurrentUser && <img src={avatarUrl} alt={username} className="w-8 h-8 rounded-full object-cover" />}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
      <div className="w-full max-w-md flex flex-col bg-gray-900 rounded-2xl shadow-2xl transform transition-transform duration-300 scale-95 animate-scale-up">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-700 to-indigo-700 p-4 flex justify-between items-center rounded-t-2xl">
          <div>
            <h2 className="text-lg font-bold text-white">{showGoldChat ? "Gold Chat" : "Global Chat"}</h2>
            <p className="text-sm text-gray-200 opacity-80">{usersConnected} personas conectadas</p>
          </div>
          <button onClick={onClose} className="text-white font-bold text-2xl hover:text-gray-200 transition">×</button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-800 max-h-[60vh]">
          {loading && <p className="text-center text-gray-400">Cargando mensajes...</p>}
          {loadError && <div className="p-2 bg-red-800 text-red-200 rounded">{loadError}</div>}

          {!loading && !loadError && (showGoldChat ? goldMessages : messages).length === 0 && (
            <div className="text-center text-gray-400 py-10">
              <p>No hay mensajes aún</p>
              <p className="text-sm mt-1">Sé el primero en escribir</p>
            </div>
          )}

          {(showGoldChat ? goldMessages : messages).map(renderMessage)}

          {typing && <div className="text-xs text-gray-400 italic">Alguien está escribiendo...</div>}
          <div ref={bottomRef} />
        </div>

        {/* Gold Chat Subscribe */}
        {!goldSubscribed && showGoldChat && (
          <div className="flex flex-col items-center justify-center p-6 bg-gray-700 text-white animate-fade-in">
            <p className="mb-4 text-center">Suscríbete para acceder al Gold Chat</p>
            <button
              onClick={handleGoldSubscribe}
              className="px-6 py-3 bg-yellow-500 text-black rounded-xl hover:bg-yellow-600 transition"
            >
              Suscribirse a Gold
            </button>
          </div>
        )}

        {/* Input */}
        {(!showGoldChat || goldSubscribed) && (
          <div className="flex gap-2 p-4 border-t border-gray-700 bg-gray-900 sticky bottom-0 shadow-inner-glow">
            <input
              type="text"
              className="flex-1 bg-gray-800 px-4 py-3 rounded-xl text-white outline-none focus:ring-2 focus:ring-purple-500 transition placeholder:text-gray-400"
              placeholder="Escribe un mensaje..."
              value={newMessage}
              onChange={(e) => {
                setNewMessage(e.target.value);
                sendTyping();
              }}
            />
            <button
              onClick={sendMessage}
              disabled={!newMessage.trim()}
              className="bg-purple-600 px-6 py-3 rounded-xl font-medium hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              Enviar
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default GlobalChatRoom;
