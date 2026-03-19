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
  const [usersConnected, setUsersConnected] = useState(42);

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
        (payload) =>
          setMessages((prev) => [...prev, payload.new as ChatMessage]),
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
        (payload) =>
          setGoldMessages((prev) => [...prev, payload.new as ChatMessage]),
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
      : {
          sender_id: currentUserId,
          room_id: roomId,
          content: newMessage.trim(),
        };

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

  const renderMessage = (m: ChatMessage) => (
    <div
      key={m.id}
      className={`flex gap-2.5 items-end ${
        m.sender_id === currentUserId ? "justify-end" : "justify-start"
      }`}
      style={{ animation: "fadeInUp 0.25s ease both" }}
    >
      {m.sender_id !== currentUserId && (
        <img
          src={m.avatar_url || "/default-avatar.png"}
          alt="avatar"
          className="w-8 h-8 rounded-full object-cover flex-shrink-0 mb-0.5"
          style={{ boxShadow: "0 0 0 2px rgba(139,92,246,0.4)" }}
        />
      )}

      <div
        className={`max-w-[72%] px-4 py-2.5 text-sm shadow-lg ${
          m.sender_id === currentUserId
            ? showGoldChat
              ? "rounded-2xl rounded-br-sm text-black"
              : "rounded-2xl rounded-br-sm text-white"
            : "rounded-2xl rounded-bl-sm text-gray-100 bg-gray-800"
        }`}
        style={
          m.sender_id === currentUserId
            ? showGoldChat
              ? {
                  background:
                    "linear-gradient(135deg, #f6d365 0%, #fda085 100%)",
                }
              : {
                  background:
                    "linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)",
                }
            : {}
        }
      >
        {m.sender_id !== currentUserId && (
          <p
            className="text-[11px] font-semibold mb-1"
            style={{ color: showGoldChat ? "#fbbf24" : "#a78bfa" }}
          >
            {m.username || m.sender_id?.slice(0, 8)}
          </p>
        )}
        <p className="leading-relaxed">{m.content}</p>
      </div>

      {m.sender_id === currentUserId && (
        <div
          className="w-8 h-8 rounded-full flex-shrink-0 mb-0.5 flex items-center justify-center text-xs font-bold text-white"
          style={{
            background: showGoldChat
              ? "linear-gradient(135deg,#f6d365,#fda085)"
              : "linear-gradient(135deg,#7c3aed,#4f46e5)",
          }}
        >
          {currentUserId?.slice(0, 1).toUpperCase()}
        </div>
      )}
    </div>
  );

  const isGold = showGoldChat && goldSubscribed;

  return (
    <>
      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes scaleUp {
          from { opacity: 0; transform: scale(0.94); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        @keyframes typingBounce {
          0%, 80%, 100% { transform: translateY(0); }
          40% { transform: translateY(-5px); }
        }
        .chat-scrollbar::-webkit-scrollbar { width: 4px; }
        .chat-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .chat-scrollbar::-webkit-scrollbar-thumb { background: rgba(107,114,128,0.4); border-radius: 9999px; }
        .typing-dot { display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: #9ca3af; animation: typingBounce 1.2s infinite ease-in-out; }
        .typing-dot:nth-child(2) { animation-delay: 0.2s; }
        .typing-dot:nth-child(3) { animation-delay: 0.4s; }
      `}</style>

      <div
        className="fixed inset-0 z-[99999] flex items-center justify-center p-4"
        style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(12px)" }}
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div
          ref={modalRef}
          className="w-full flex flex-col overflow-hidden relative"
          style={{
            maxWidth: 380,
            height: 620,
            background: "#0f0f14",
            borderRadius: 28,
            boxShadow:
              "0 32px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.06)",
            animation: "scaleUp 0.22s ease both",
          }}
        >
          {/* Header */}
          <div
            className="relative flex items-center justify-between px-5 py-4 flex-shrink-0"
            style={{
              background: isGold
                ? "linear-gradient(135deg, #92400e 0%, #d97706 50%, #f59e0b 100%)"
                : "linear-gradient(135deg, #5b21b6 0%, #6d28d9 50%, #7c3aed 100%)",
              boxShadow: isGold
                ? "0 4px 24px rgba(217,119,6,0.4)"
                : "0 4px 24px rgba(109,40,217,0.4)",
            }}
          >
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-2xl flex items-center justify-center text-xl flex-shrink-0"
                style={{
                  background: "rgba(255,255,255,0.18)",
                  backdropFilter: "blur(8px)",
                }}
              >
                {isGold ? "👑" : "🌍"}
              </div>
              <div>
                <h2 className="text-white font-bold text-xl leading-tight">
                  {isGold ? "Gold Chat" : "Global Chat"}
                </h2>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span
                    className="w-2 h-2 rounded-full bg-green-400 flex-shrink-0"
                    style={{ animation: "pulse-dot 2s infinite" }}
                  />
                  <span className="text-white/75 text-xs">
                    {usersConnected} conectados
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {goldSubscribed && (
                <button
                  type="button"
                  onClick={toggleChatMode}
                  className="text-xs font-semibold px-3 py-1.5 rounded-xl transition-all active:scale-95"
                  style={{
                    background: "rgba(255,255,255,0.2)",
                    color: "white",
                    border: "1px solid rgba(255,255,255,0.25)",
                  }}
                >
                  {showGoldChat ? "Global" : "Gold"}
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="w-9 h-9 flex items-center justify-center rounded-full text-white font-light text-2xl transition-all active:scale-90"
                style={{
                  background: "rgba(255,255,255,0.15)",
                  border: "1px solid rgba(255,255,255,0.2)",
                }}
                aria-label="Cerrar"
              >
                ×
              </button>
            </div>
          </div>

          {/* Messages Area */}
          <div
            className="flex-1 overflow-y-auto px-4 py-4 space-y-3 chat-scrollbar"
            style={{ background: "#0f0f14" }}
          >
            {loading && (
              <div className="flex flex-col items-center justify-center h-full gap-3">
                <div
                  className="w-8 h-8 rounded-full border-2 border-purple-500 border-t-transparent"
                  style={{ animation: "spin 0.8s linear infinite" }}
                />
                <p className="text-gray-500 text-sm">Cargando mensajes...</p>
              </div>
            )}

            {loadError && (
              <div
                className="p-4 rounded-2xl text-center text-sm"
                style={{
                  background: "rgba(239,68,68,0.12)",
                  color: "#fca5a5",
                  border: "1px solid rgba(239,68,68,0.2)",
                }}
              >
                {loadError}
              </div>
            )}

            {!loading &&
              !loadError &&
              (showGoldChat ? goldMessages : messages).length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-center px-6 gap-4">
                  <div
                    className="w-16 h-16 rounded-3xl flex items-center justify-center text-3xl"
                    style={{
                      background: "rgba(139,92,246,0.12)",
                      border: "1px solid rgba(139,92,246,0.2)",
                    }}
                  >
                    💬
                  </div>
                  <div>
                    <p className="text-white font-semibold text-base">
                      No hay mensajes aún
                    </p>
                    <p className="text-gray-500 text-sm mt-1">
                      Sé el primero en escribir algo interesante
                    </p>
                  </div>
                </div>
              )}

            {(showGoldChat ? goldMessages : messages).map(renderMessage)}

            {typing && (
              <div className="flex items-center gap-2 pl-11">
                <div
                  className="px-4 py-3 rounded-2xl rounded-bl-sm flex items-center gap-1"
                  style={{ background: "#1e1e2a" }}
                >
                  <span className="typing-dot" />
                  <span className="typing-dot" />
                  <span className="typing-dot" />
                </div>
                <span className="text-gray-600 text-xs italic">
                  escribiendo...
                </span>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Gold Subscription Screen — overlays only the content area */}
          {!goldSubscribed && showGoldChat && (
            <div
              className="absolute left-0 right-0 bottom-0 z-10 flex flex-col items-center justify-center text-center px-8 py-10"
              style={{
                top: 82,
                background:
                  "linear-gradient(180deg, #0f0f14 0%, #1a1408 60%, #0f0f14 100%)",
                borderTop: "1px solid rgba(255,255,255,0.05)",
              }}
            >
              <div
                className="w-20 h-20 rounded-3xl flex items-center justify-center text-4xl mb-6"
                style={{
                  background:
                    "linear-gradient(135deg, rgba(217,119,6,0.2), rgba(245,158,11,0.1))",
                  border: "1px solid rgba(245,158,11,0.3)",
                  boxShadow: "0 0 40px rgba(217,119,6,0.15)",
                }}
              >
                👑
              </div>
              <h3
                className="text-2xl font-bold mb-2"
                style={{ color: "#f59e0b" }}
              >
                Gold Chat
              </h3>
              <p className="text-gray-400 text-sm mb-8 leading-relaxed max-w-[240px]">
                Accede al chat premium con contenido exclusivo y miembros Gold
              </p>
              <button
                onClick={handleGoldSubscribe}
                className="w-full py-4 font-bold text-base rounded-2xl transition-all active:scale-95"
                style={{
                  background:
                    "linear-gradient(135deg, #f6d365 0%, #fda085 100%)",
                  color: "#1a0a00",
                  boxShadow: "0 8px 32px rgba(246,211,101,0.3)",
                }}
              >
                Suscribirse a Gold ✦
              </button>
              <button
                type="button"
                onClick={onClose}
                className="mt-4 text-gray-600 text-sm hover:text-gray-400 transition-colors"
              >
                Cancelar
              </button>
            </div>
          )}

          {/* Message Input */}
          {(!showGoldChat || goldSubscribed) && (
            <div
              className="flex-shrink-0 px-4 py-4"
              style={{
                background: "#0f0f14",
                borderTop: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <div className="flex gap-2 items-center">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => {
                    setNewMessage(e.target.value);
                    if (e.target.value.trim()) sendTyping();
                  }}
                  onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                  placeholder="Escribe un mensaje..."
                  className="flex-1 text-sm text-white placeholder-gray-600 px-5 py-3.5 outline-none transition-all"
                  style={{
                    background: "#1a1a24",
                    borderRadius: 18,
                    border: "1px solid rgba(255,255,255,0.08)",
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = isGold
                      ? "rgba(245,158,11,0.5)"
                      : "rgba(139,92,246,0.5)";
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor =
                      "rgba(255,255,255,0.08)";
                  }}
                />
                <button
                  onClick={sendMessage}
                  disabled={!newMessage.trim()}
                  className="flex-shrink-0 w-12 h-12 flex items-center justify-center rounded-2xl font-medium text-base transition-all active:scale-90 disabled:opacity-40 disabled:cursor-not-allowed"
                  style={
                    newMessage.trim()
                      ? {
                          background: isGold
                            ? "linear-gradient(135deg, #f6d365, #fda085)"
                            : "linear-gradient(135deg, #7c3aed, #4f46e5)",
                          color: isGold ? "#1a0a00" : "white",
                          boxShadow: isGold
                            ? "0 4px 16px rgba(246,211,101,0.3)"
                            : "0 4px 16px rgba(124,58,237,0.4)",
                        }
                      : { background: "#1a1a24", color: "#4b5563" }
                  }
                  aria-label="Enviar"
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <line x1="22" y1="2" x2="11" y2="13" />
                    <polygon points="22 2 15 22 11 13 2 9 22 2" />
                  </svg>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default GlobalChatRoom;
