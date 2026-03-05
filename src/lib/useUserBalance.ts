import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

export const useUserBalance = (userId: string | null) => {
  const [balance, setBalance] = useState<number>(0);
  const [boost, setBoost] = useState<number>(0);

  useEffect(() => {
    if (!userId) return;

    const fetchBalance = async () => {
      const { data, error } = await supabase
        .from("user_balances")
        .select("wld_balance, boost_credit_balance")
        .eq("user_id", userId)
        .single();

      if (!error && data) {
        setBalance(data.wld_balance);
        setBoost(data.boost_credit_balance);
      }
    };

    fetchBalance();

    // Suscripción en tiempo real
    const channel = supabase
      .channel(`realtime-user-balance-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_balances", filter: `user_id=eq.${userId}` },
        (payload) => {
          if (payload.new) {
            setBalance(payload.new.wld_balance);
            setBoost(payload.new.boost_credit_balance);
          }
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [userId]);

  return { balance, boost };
};
