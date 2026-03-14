import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { userId } = req.body;
  if (!userId) {
    return res.status(400).json({ error: "No userId provided" });
  }

  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("username, avatar_url")
      .eq("id", userId)
      .maybeSingle();

    if (error) throw error;

    return res.status(200).json({ profile: data });
  } catch (err) {
    console.error("[GET-PROFILE] Error:", err);
    return res.status(500).json({ error: err.message });
  }
}
