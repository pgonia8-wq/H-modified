import { createClient } from "@supabase/supabase-js";

// 🔑 Mantengo tu estructura con variables de entorno
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ success: false, error: "No userId provided" });
    }

    // 🔍 Verifico si el profile ya existe primero
    const { data: existingProfile, error: selectError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    if (selectError) throw selectError;

    if (existingProfile) {
      console.log("[CREATE PROFILE] Profile already exists:", existingProfile);
      return res.status(200).json({ success: true, profile: existingProfile });
    }

    // ➕ Insert profile solo si no existe
    const { data, error } = await supabase
      .from("profiles")
      .insert({
        id: userId,
        tier: "free",
        username: "Anon",
        avatar_url: ""
      })
      .select()
      .maybeSingle(); // devuelve null si ya existe

    if (error) throw error;

    console.log("[CREATE PROFILE] New profile created:", data);
    res.status(200).json({ success: true, profile: data });

  } catch (err) {
    console.error("[CREATE PROFILE] error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
  }
