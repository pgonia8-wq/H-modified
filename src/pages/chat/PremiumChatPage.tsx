import React, { useEffect, useState } from "react";
import GlobalChatRoom from "./GlobalChatRoom";
import { supabase } from "../../supabaseClient";

const PremiumChatPage = ({
  currentUserId,
}: {
  currentUserId: string | null;
}) => {

  const [hasAccess, setHasAccess] = useState<boolean | null>(null);

  useEffect(() => {
    const checkAccess = async () => {
      if (!currentUserId) return;

      const { data } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("user_id", currentUserId)
        .eq("product", "chat_gold")
        .eq("active", true)
        .maybeSingle();

      if (!data) {
        setHasAccess(false);
        return;
      }

      const valid =
        !data.expires_at || new Date(data.expires_at) > new Date();

      setHasAccess(valid);
    };

    checkAccess();
  }, [currentUserId]);

  // ⏳ loading
  if (hasAccess === null) {
    return (
      <p className="text-center p-10 text-gray-400">
        Cargando acceso...
      </p>
    );
  }

  // 🔒 sin acceso
  if (!hasAccess) {
    return (
      <p className="text-center p-10 text-red-500">
        Acceso exclusivo 🐋 — desbloquea Chat Gold
      </p>
    );
  }

  // ✅ acceso permitido
  return (
    <GlobalChatRoom
      currentUserId={currentUserId!}
      roomId="premium_whales"
    />
  );
};

export default PremiumChatPage;
