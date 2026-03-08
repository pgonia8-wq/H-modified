import { createClient } from "@supabase/supabase-js";

// Supabase con Service Role Key (nunca exponer en frontend)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  console.log("[BACKEND] Verificando World ID...");

  if (req.method !== "POST") {
    console.log("[BACKEND] Método no permitido:", req.method);
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  const body = req.body || {};
  const { payload } = body;

  if (!payload || !payload.nullifier_hash || !payload.proof || !payload.merkle_root || !payload.verification_level) {
    console.error("[BACKEND] Faltan campos en proof:", body);
    return res.status(400).json({ success: false, error: "Faltan campos en proof" });
  }

  const nullifierHash = payload.nullifier_hash;
  console.log("[BACKEND] nullifier_hash recibido:", nullifierHash);

  // Verificar en Worldcoin API oficial
  let verifyData;
  try {
    const verifyResponse = await fetch(
      "https://developer.worldcoin.org/api/v2/verify/app_6a98c88249208506dcd4e04b529111fc",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          merkle_root: payload.merkle_root,
          proof: payload.proof,
          nullifier_hash: nullifierHash,
          verification_level: payload.verification_level,
        }),
      }
    );

    verifyData = await verifyResponse.json();
    console.log("[BACKEND] Respuesta de Worldcoin:", verifyData);

    if (!verifyResponse.ok || !verifyData.success) {
      console.error("[BACKEND] Worldcoin rechazó:", verifyData);
      return res.status(400).json({ success: false, error: verifyData.detail || "Verificación fallida en Worldcoin" });
    }
  } catch (err) {
    console.error("[BACKEND] Error al verificar con Worldcoin:", err);
    return res.status(500).json({ success: false, error: "Error al contactar Worldcoin" });
  }

  // Guardar/actualizar en profiles (upsert)
  try {
    const { error: upsertError } = await supabase
      .from("profiles")
      .upsert(
        {
          id: nullifierHash,
          tier: "free", // default, luego upgrade lo sube
          verified: true,
          updated_at: new Date().toISOString(),
          // Puedes agregar wallet si lo tienes en payload
          wallet_address: payload.walletAddress || null,
        },
        { onConflict: 'id' }
      );

    if (upsertError) {
      console.error("[BACKEND] Error upsert profiles:", upsertError);
      return res.status(500).json({ success: false, error: upsertError.message });
    }

    console.log("[BACKEND] Perfil creado/actualizado:", nullifierHash);
  } catch (err) {
    console.error("[BACKEND] Error Supabase profiles:", err);
    return res.status(500).json({ success: false, error: "Error al guardar perfil" });
  }

  // Guardar proof en tabla separada (auditoría)
  try {
    const { error: proofError } = await supabase
      .from("world_id_proofs")
      .insert({
        nullifier_hash: nullifierHash,
        merkle_root: payload.merkle_root,
        proof: payload.proof,
        verification_level: payload.verification_level,
        backend_response: JSON.stringify(verifyData),
        created_at: new Date().toISOString(),
      });

    if (proofError) {
      console.error("[BACKEND] Error insert world_id_proofs:", proofError);
      // No fallamos el request por esto, es opcional
    } else {
      console.log("[BACKEND] Proof guardado en world_id_proofs");
    }
  } catch (err) {
    console.error("[BACKEND] Error Supabase world_id_proofs:", err);
  }

  return res.status(200).json({ success: true, nullifier_hash: nullifierHash });
}
