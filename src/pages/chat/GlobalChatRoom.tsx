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
  username?: string;
  avatar_url?: string;
  content: string;
  created_at?: string;
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
  const [usersConnected, setUsersConnected] = useState(42); // Simulado (puedes conectar con presence después)

  const bottomRef = useRef<HTMLDivElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // Load Classic Messages
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

  // Load Gold Messages
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

  // Realtime Classic Chat
  useEffect(() => {
    const channel = supabase.channel(`global-chat-${roomId}`);
    channel
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "global_chat_messages",
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => setMessages((prev) => [...prev, payload.new as ChatMessage])
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

  // Realtime Gold Chat
  useEffect(() => {
    if (!goldSubscribed || !showGoldChat) return;
    const channel = supabase.channel(`gold-chat`);
    channel
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "gold_chat_messages" },
        (payload) => setGoldMessages((prev) => [...prev, payload.new as ChatMessage])
      )
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [goldSubscribed, showGoldChat]);

  // Auto scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, goldMessages, showGoldChat]);

  const sendTyping = async () => {
    const channel = supabase.channel(`global-chat-${roomId}`);
    await channel.send({
      type: "broadcast",
      event: "typing",
      payload: { user: currentUserId },
    });
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

  const toggleChatMode = () => {
    if (showGoldChat) {
      setShowGoldChat(false);
    } else if (goldSubscribed) {
      setShowGoldChat(true);
    }
  };

  // Render single message
  const renderMessage = (m: ChatMessage) => (
    <div
      key={m.id}
      className={`flex gap-3 items-start ${
        m.sender_id === currentUserId ? "justify-end" : "justify-start"
      } animate-fade-in`}
    >
      {m.sender_id !== currentUserId && (
        <img
          src={m.avatar_url || "/default-avatar.png"}
          alt="avatar"
          className="w-8 h-8 rounded-full object-cover ring-2 ring-gray-700 flex-shrink-0"
        />
      )}

      <div
        className={`max-w-[75%] px-4 py-3 rounded-3xl text-sm shadow-md transition-all ${
          m.sender_id === currentUserId
            ? "bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-br-none"
            : "bg-gray-700 text-gray-100 rounded-bl-none"
        }`}
      >
        {m.sender_id !== currentUserId && (
          <p className="text-xs font-semibold text-purple-300 mb-1">
            {m.username || m.sender_id?.slice(0, 8)}
          </p>
        )}
        <p>{m.content}</p>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/70 backdrop-blur-md p-4">
      <div
        ref={modalRef}
        className="w-full max-w-[380px] flex flex-col bg-gray-900 rounded-3xl shadow-2xl overflow-hidden 
                   animate-scale-up transition-all duration-300"
      >
        {/* Header - Exactamente como en tu imagen */}
        <div className="bg-gradient-to-r from-purple-600 to-violet-600 p-4 flex items-center justify-between rounded-t-3xl">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-white/20 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0">
              🌍
            </div>
            <div>
              <h2 className="text-white text-[22px] font-bold">Global Chat</h2>
              <p className="text-white/80 text-sm flex items-center gap-1.5">
                <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                {usersConnected} conectados
              </p>
            </div>
          </div>

          {/* Botón X que aparece en tu imagen - ahora funcional */}
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-white text-3xl hover:bg-white/20 rounded-full transition"
          >
            ×
          </button>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-gray-950 max-h-[460px] scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent">
          {loading && (
            <p className="text-center text-gray-400 py-10">Cargando mensajes...</p>
          )}

          {loadError && (
            <div className="p-4 bg-red-900/50 text-red-200 rounded-2xl text-center">
              {loadError}
            </div>
          )}

          {!loading && !loadError && (showGoldChat ? goldMessages : messages).length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <div className="text-6xl mb-6">💬</div>
              <p className="font-medium text-lg">No hay mensajes aún</p>
              <p className="text-sm mt-1">Sé el primero en escribir algo interesante</p>
            </div>
          )}

          {(showGoldChat ? goldMessages : messages).map(renderMessage)}

          {typing && (
            <div className="flex items-center gap-2 text-xs text-gray-400 italic pl-12">
              <div className="flex gap-1">
                <span className="animate-bounce">•</span>
                <span className="animate-bounce delay-150">•</span>
                <span className="animate-bounce delay-300">•</span>
              </div>
              Alguien está escribiendo...
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Gold Subscription Screen */}
        {!goldSubscribed && showGoldChat && (
          <div className="absolute inset-0 z-10 p-8 bg-gradient-to-b from-gray-900 to-yellow-950/30 flex flex-col items-center justify-center text-center">
            <div className="text-6xl mb-6">🔒</div>
            <h3 className="text-2xl font-bold text-yellow-400 mb-2">Gold Chat</h3>
            <p className="text-gray-300 mb-8 max-w-[260px]">
              Suscríbete para acceder al chat premium con contenido exclusivo
            </p>
            <button
              onClick={handleGoldSubscribe}
              className="w-full py-4 bg-gradient-to-r from-yellow-400 to-amber-500 text-black font-semibold rounded-2xl hover:scale-105 active:scale-95 transition transform"
            >
              Suscribirse a Gold
            </button>
          </div>
        )}

        {/* Message Input */}
        {(!showGoldChat || goldSubscribed) && (
          <div className="p-4 border-t border-gray-800 bg-gray-900">
            <div className="flex gap-3">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => {
                  setNewMessage(e.target.value);
                  if (e.target.value.trim()) sendTyping();
                }}
                onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                placeholder="Escribe un mensaje..."
                className="flex-1 bg-gray-800 text-white placeholder-gray-500 px-5 py-4 rounded-2xl focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all"
              />
              <button
                onClick={sendMessage}
                disabled={!newMessage.trim()}
                className="px-7 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 disabled:cursor-not-allowed font-medium rounded-2xl transition-all active:scale-95"
              >
                Enviar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default GlobalChatRoom;
