// src/api/upgrade.ts
import { supabase } from "../supabaseClient";
import { nanoid } from "nanoid";

const PREMIUM_LIMIT = 10000;
const PREMIUM_PLUS_LIMIT = 3000;

interface UpgradeRequest {
  userId: string;
  tier: "premium" | "premium+";
  transactionId: string; // ID de la transacción WLD
  referralToken?: string; // opcional, si viene de un referido
}

// Obtiene precio dinámico según cantidad de usuarios ya subidos
async function getUpgradePrice(tier: "premium" | "premium+") {
  if (tier === "premium") {
    const { count } = await supabase
      .from("upgrades")
      .select("*", { count: "exact" })
      .eq("tier", "premium");
    return count! < PREMIUM_LIMIT ? 10 : 20;
  } else {
    const { count } = await supabase
      .from("upgrades")
      .select("*", { count: "exact" })
      .eq("tier", "premium+");
    return count! < PREMIUM_PLUS_LIMIT ? 15 : 35;
  }
}

// Crea token de referido dinámico
async function createReferralToken(userId: string) {
  const token = nanoid(10); // token único
  const { error } = await supabase.from("referral_tokens").insert({
    token,
    created_by: userId,
    tier: "premium",
    boost_limit: 1, // 1 boost diario
    tips_allowed: false, // sin tips
    created_at: new Date().toISOString(),
  });

  if (error) throw error;
  return token;
}

// Maneja upgrade de usuario
export default async function handler(req: any, res: any) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Método no permitido" });
    }

    const { userId, tier, transactionId, referralToken } = req.body as UpgradeRequest;

    if (!userId || !tier || !transactionId) {
      return res.status(400).json({ error: "Faltan parámetros obligatorios" });
    }

    // TODO: Aquí puedes validar transactionId con API de Worldcoin
    // const paymentValid = await verifyWLDTransaction(transactionId);
    const paymentValid = true; // placeholder
    if (!paymentValid) {
      return res.status(400).json({ error: "Transacción inválida" });
    }

    // Verifica precio dinámico
    const price = await getUpgradePrice(tier);

    // Inserta upgrade en Supabase
    const { error: insertError } = await supabase.from("upgrades").insert({
      user_id: userId,
      tier,
      price,
      start_date: new Date().toISOString(),
      transaction_id: transactionId,
    });

    if (insertError) throw insertError;

    // Si viene referralToken válido, activa 1 mes gratis con boost limitado
    if (referralToken) {
      const { data: tokenData } = await supabase
        .from("referral_tokens")
        .select("*")
        .eq("token", referralToken)
        .single();

      if (tokenData) {
        await supabase.from("upgrades").insert({
          user_id: userId,
          tier: tokenData.tier,
          price: 0,
          start_date: new Date().toISOString(),
          transaction_id: `referral-${nanoid(6)}`,
          boost_limit: tokenData.boost_limit,
          tips_allowed: tokenData.tips_allowed,
        });

        // Marcar token como usado
        await supabase
          .from("referral_tokens")
          .update({ used_by: userId, used_at: new Date().toISOString() })
          .eq("token", referralToken);
      }
    }

    // Genera nuevo token de referido para que el usuario pueda invitar
    const newReferralToken = await createReferralToken(userId);

    return res.status(200).json({
      message: "Upgrade exitoso ✅",
      price,
      referralToken: newReferralToken,
    });
  } catch (err: any) {
    console.error("Error en upgrade:", err);
    return res.status(500).json({ error: err.message || "Error interno" });
  }
}
