import { supabase } from "../supabaseClient";

export const useWithdraw = () => {
  const requestWithdraw = async (
    userId: string,
    amount: number,
    wallet: string
  ) => {
    if (!userId) throw new Error("No user");
    if (!wallet) throw new Error("Wallet requerida");
    if (amount <= 0) throw new Error("Monto inválido");

    // 🔥 OPCIONAL (pero recomendado): validar saldo
    const { data: balanceData, error: balanceError } = await supabase
      .from("balances") // usa la tabla correcta que elegiste
      .select("available")
      .eq("user_id", userId)
      .single();

    if (balanceError) throw balanceError;

    if (!balanceData || balanceData.available < amount) {
      throw new Error("Fondos insuficientes");
    }

    // crear retiro
    const { error } = await supabase.from("withdrawals").insert({
      user_id: userId,
      amount,
      wallet_address: wallet,
      status: "pending",
    });

    if (error) throw error;

    return true;
  };

  return { requestWithdraw };
};
