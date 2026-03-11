import React, { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";

interface ChatModalProps {
  conversationId: string;
  fromUserId: string;
  toUserId: string;
  onClose: () => void;
}

const ChatModal: React.FC<ChatModalProps> = ({ conversationId, fromUserId, toUserId, onClose }) => {
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");

  const fetchMessages = async () => {
    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("timestamp", { ascending: true });

    if (!error) setMessages(data || []);
  };

  useEffect(() => {
    fetchMessages();
  }, [conversationId]);

  const sendMessage = async () => {
    if (!newMessage.trim()) return;

    const { error } = await supabase
      .from("messages")
      .insert({
        conversation_id: conversationId,
        from_user_id: fromUserId,
        to_user_id: toUserId,
        content: newMessage.trim(),
        timestamp: new Date().toISOString()
      });

    if (!error) {
      setNewMessage("");
      fetchMessages();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="bg-gray-900 rounded-2xl w-full max-w-md p-4 flex flex-col">
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-white font-bold text-lg">Chat DM</h2>
          <button onClick={onClose} className="text-gray-400 font-bold">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto mb-2 max-h-96">
          {messages.map((msg) => (
            <div key={msg.id} className={`p-2 rounded my-1 ${msg.from_user_id === fromUserId ? "bg-blue-600 text-white self-end" : "bg-gray-700 text-white self-start"}`}>
              {msg.content}
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            className="flex-1 p-2 rounded bg-gray-800 text-white"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Escribe un mensaje..."
          />
          <button onClick={sendMessage} className="px-4 py-2 bg-purple-600 rounded">Enviar</button>
        </div>
      </div>
    </div>
  );
};

export default ChatModal;
