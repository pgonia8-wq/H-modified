import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

export const useProfileStats = (userId: string | null) => {
  const [postsCount, setPostsCount] = useState(0);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;

    const fetchStats = async () => {
      setLoading(true);

      const { count: posts } = await supabase
        .from("posts")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId);

      const { count: followers } = await supabase
        .from("follows")
        .select("*", { count: "exact", head: true })
        .eq("following_id", userId);

      const { count: following } = await supabase
        .from("follows")
        .select("*", { count: "exact", head: true })
        .eq("follower_id", userId);

      setPostsCount(posts || 0);
      setFollowersCount(followers || 0);
      setFollowingCount(following || 0);

      setLoading(false);
    };

    fetchStats();
  }, [userId]);

  return { postsCount, followersCount, followingCount, loading };
};
