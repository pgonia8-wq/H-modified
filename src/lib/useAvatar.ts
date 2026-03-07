import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

const avatarCache: Record<string, string> = {}; // Cache simple en memoria

export const useAvatar = (userId: string | null) => {
  const [avatarUrl, setAvatarUrl] = useState<string>("default-avatar.png");
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!userId) {
      setAvatarUrl("default-avatar.png");
      setLoading(false);
      return;
    }

    // Si ya está en cache, úsalo
    if (avatarCache[userId]) {
      setAvatarUrl(avatarCache[userId]);
      setLoading(false);
      return;
    }

    const fetchAvatar = async () => {
      try {
        const { data } = supabase.storage
          .from("avatars")
          .getPublicUrl(`${userId}.png`);

        if (data?.publicUrl) {
          avatarCache[userId] = data.publicUrl; // guarda en cache
          setAvatarUrl(data.publicUrl);
        } else {
          setAvatarUrl("default-avatar.png");
        }
      } catch (err) {
        console.error("Error fetching avatar:", err);
        setAvatarUrl("default-avatar.png");
      } finally {
        setLoading(false);
      }
    };

    fetchAvatar();
  }, [userId]);

  return { avatarUrl, loading };
};
