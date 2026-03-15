// /api/updateScores.mjs
import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error("Supabase env vars missing");
      return res.status(500).json({
        success: false,
        error: "Supabase env vars missing",
      });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Validación opcional si usas CRON_SECRET
    if (
      process.env.CRON_SECRET &&
      req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`
    ) {
      return res.status(401).end("Unauthorized");
    }

    // Ejecuta la función SQL
    const { error } = await supabase.rpc("update_post_scores");

    if (error) throw error;

    return res.status(200).json({
      success: true,
      message: "Scores updated",
    });
  } catch (err) {
    console.error("Error updating scores:", err);

    return res.status(500).json({
      success: false,
      error: err.message,
    });
  }
}
