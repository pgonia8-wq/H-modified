import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  console.log("[BACKEND] Verifying World ID…");

  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  const body = req.body || {};
  const { payload, action, walletAddress = null, miniKitData = null } = body;

  if (!payload || !payload.nullifier_hash || !payload.proof || !payload.merkle_root) {
    console.error("[BACKEND] Missing proof fields:", body);
    return res.status(400).json({ success: false, error: "Missing proof fields" });
  }

  const userId = payload.nullifier_hash;
  console.log("[BACKEND] nullifier_hash:", userId);

  // — Call Worldcoin API V2 Verify
  try {
    const verifyResponse = await fetch(
      `https://developer.worldcoin.org/api/v2/verify/${process.env.WORLDCOIN_APP_ID}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          merkle_root: payload.merkle_root,
          nullifier_hash: payload.nullifier_hash,
          proof: payload.proof,
          verification_level: payload.verification_level,
          action,
        }),
      }
    );

    const verifyData = await verifyResponse.json();
    console.log("[BACKEND] Worldcoin verify response:", verifyData);

    if (!verifyData.success) {
      console.error("[BACKEND] Worldcoin rejected the proof");
      return res.status(400).json({ success: false, error: "Worldcoin validation failed", verifyData });
    }

  } catch (err) {
    console.error("[BACKEND] Error calling Worldcoin verify:", err);
    return res.status(500).json({ success: false, error: "Worldcoin service error" });
  }

  // — Guardar en Supabase
  try {
    const { error: upsertError } = await supabase
      .from("profiles")
      .upsert(
        {
          id: userId,
          verified: true,
          wallet_address: walletAddress,
          minikitData: JSON.stringify(miniKitData)
        },
        { onConflict: ["id"] }
      );

    if (upsertError) {
      console.error("[BACKEND] Supabase upsert error:", upsertError);
      return res.status(500).json({ success: false, error: upsertError.message });
    }

    console.log("[BACKEND] Guardado en Supabase:", userId);

    return res.status(200).json({ success: true, userId });

  } catch (err) {
    console.error("[BACKEND] Supabase error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
