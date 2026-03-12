import React, { useState, useEffect, useContext } from "react";
import { supabase } from "../supabaseClient";
import { ThemeContext } from "../lib/ThemeContext";
import { useFollow } from "../lib/useFollow";
import { MiniKit, Tokens, tokenToDecimals } from "@worldcoin/minikit-js";

interface PostCardProps {
  post: any;
  currentUserId: string | null;
}

const RECEIVER = "0xdf4a991bc05945bd0212e773adcff6ea619f4c4b";

const PostCard: React.FC<PostCardProps> = ({ post, currentUserId }) => {

  const { theme } = useContext(ThemeContext);

  const [avatar, setAvatar] = useState(post.profile?.avatar_url);

  const [liked, setLiked] = useState(false);
  const [likes, setLikes] = useState(post.likes || 0);
  const [reposts, setReposts] = useState(post.reposts || 0);
  const [comments, setComments] = useState(post.comments || 0);

  const [followers, setFollowers] = useState(post.profile?.followers_count || 0);
  const [following, setFollowing] = useState(post.profile?.following_count || 0);

  const { isFollowing, toggleFollow, loading: followLoading } = useFollow(
    currentUserId,
    post.user_id
  );

  const [tipAmount, setTipAmount] = useState<number | "">("");
  const [isBoosting, setIsBoosting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const accentColor = "#7c3aed";

  const [score, setScore] = useState(0);
  const [tags, setTags] = useState<string[]>(post.tags || []);

  /* --------------------------------
     LISTENER ACTUALIZACIÓN AVATAR
  -------------------------------- */

  useEffect(() => {

    const handleAvatarUpdate = (event: any) => {

      if (event.detail.userId === post.user_id) {
        setAvatar(event.detail.avatarUrl);
      }

    };

    window.addEventListener("avatarUpdated", handleAvatarUpdate);

    return () => {
      window.removeEventListener("avatarUpdated", handleAvatarUpdate);
    };

  }, [post.user_id]);

  /* --------------------------------
     SCORE FEED
  -------------------------------- */

  useEffect(() => {

    const calculateScore = async () => {

      const { data: tipsData } = await supabase
        .from("tips")
        .select("amount_total")
        .eq("post_id", post.id);

      const totalTips =
        tipsData?.reduce((sum, tip) => sum + tip.amount_total, 0) || 0;

      const boostActive =
        post.boosted_until && new Date(post.boosted_until) > new Date() ? 1 : 0;

      const hoursSincePost = post.timestamp
        ? Math.max(
            (Date.now() - new Date(post.timestamp).getTime()) /
              (1000 * 60 * 60),
            0
          )
        : 0;

      const recencyDecay = 1 / Math.pow(hoursSincePost + 1, 1.2);

      const tagScore = tags.length * 0.5;

      const calculatedScore =
        (likes || 0) * 1 +
        (comments || 0) * 2 +
        (reposts || 0) * 2 +
        totalTips * 3 +
        boostActive * 10 +
        recencyDecay +
        tagScore;

      setScore(calculatedScore);

    };

    calculateScore();

  }, [post.id, likes, comments, reposts, post.boosted_until, post.timestamp, tags]);

  /* --------------------------------
     FOLLOW STATS
  -------------------------------- */

  useEffect(() => {

    if (!post.user_id) return;

    const fetchStats = async () => {

      const { data } = await supabase
        .from("profiles")
        .select("followers_count, following_count")
        .eq("id", post.user_id)
        .single();

      if (data) {
        setFollowers(data.followers_count || 0);
        setFollowing(data.following_count || 0);
      }

    };

    fetchStats();

  }, [post.user_id]);

  /* --------------------------------
     TIP
  -------------------------------- */

  const handleTip = async () => {

    if (!currentUserId || !tipAmount || tipAmount < 1) {
      setError("Tip mínimo 1 WLD");
      return;
    }

    if (!confirm(`¿Confirmar tip de ${tipAmount} WLD?`)) return;

    try {

      if (!MiniKit.isInstalled()) {
        throw new Error("World App no detectada");
      }

      const payRes = await MiniKit.commandsAsync.pay({
        reference: "tip-" + post.id + "-" + Date.now(),
        to: RECEIVER,
        tokens: [
          {
            symbol: Tokens.WLD,
            token_amount: tokenToDecimals(tipAmount, Tokens.WLD).toString()
          }
        ],
        description: `Tip for ${post.profile?.username}`
      });

      if (payRes?.finalPayload?.status !== "success") {
        throw new Error("Tip cancelado");
      }

      await supabase.from("tips").insert({
        post_id: post.id,
        sender_id: currentUserId,
        receiver_id: post.user_id,
        amount_total: tipAmount
      });

      alert(`Tip enviado: ${tipAmount} WLD`);

      setTipAmount("");

    } catch (err: any) {

      setError(err.message);

    }

  };

  /* --------------------------------
     UI
  -------------------------------- */

  return (

    <div className="bg-gray-900/60 backdrop-blur-sm rounded-2xl p-4 space-y-4 border border-white/10">

      <div className="flex items-center gap-3">

        <img
          src={avatar || "/default-avatar.png"}
          className="w-10 h-10 rounded-full object-cover"
        />

        <div className="flex-1">

          <h3 className="font-bold text-white">
            {post.profile?.username || "Anon"}
          </h3>

          <div className="text-gray-400 text-xs flex gap-3 mt-1">

            <span>Followers: {followers}</span>

            <span>Following: {following}</span>

            <span>
              🕒 {new Date(post.timestamp || "").toLocaleString()}
            </span>

          </div>

        </div>

      </div>

      <p className="text-white whitespace-pre-wrap">
        {post.content}
      </p>

      <div className="flex gap-4 text-gray-400 text-sm">

        <button onClick={() => setLiked(!liked)}>
          {liked ? "❤️" : "♡"} {likes}
        </button>

        <span className="ml-auto font-bold text-white">
          Score: {score.toFixed(2)}
        </span>

      </div>

    </div>

  );

};

export default PostCard;
