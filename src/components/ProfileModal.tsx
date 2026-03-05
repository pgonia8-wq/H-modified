import React, { useEffect, useState, useContext, useRef } from "react";
import { supabase } from "../supabaseClient";
import { ThemeContext } from "../lib/ThemeContext";

interface ProfileModalProps {
  currentUserId: string | null;
  onClose: () => void;
  showUpgradeButton?: boolean;
}

interface UserProfile {
  id: string;
  name: string;
  username: string;
  avatar_url: string;
  tier: "free" | "basic" | "premium" | "premium+";
  bio: string;
  created_at: string;
  birthdate: string;
  city: string;
  country: string;
  posts_count: number;
  followers_count: number;
  following_count: number;
}

const emptyProfile: UserProfile = {
  id: "",
  name: "",
  username: "",
  avatar_url: "",
  tier: "free",
  bio: "",
  created_at: "",
  birthdate: "",
  city: "",
  country: "",
  posts_count: 0,
  followers_count: 0,
  following_count: 0,
};

const ProfileModal: React.FC<ProfileModalProps> = ({
  currentUserId,
  onClose,
  showUpgradeButton = true,
}) => {
  const [profile, setProfile] = useState(emptyProfile);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [activeTab, setActiveTab] = useState<"posts" | "responses" | "likes">("posts");
  const [bioLength, setBioLength] = useState(0);
  const { theme, setTheme } = useContext(ThemeContext);

  const avatarInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const loadOrCreateProfile = async () => {
      setLoading(true);
      setError(null);

      if (!currentUserId) {
        setProfile({ ...emptyProfile, id: "guest", username: "invitado" });
        setLoading(false);
        return;
      }

      try {
        const { data, error: fetchError } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", currentUserId)
          .single();

        if (fetchError && fetchError.code !== "PGRST116") {
          throw fetchError;
        }

        if (data) {
          setProfile(data);
          setBioLength(data.bio?.length || 0);
        } else {
          const newProfile = {
            id: currentUserId,
            name: "",
            username: `user_${currentUserId.slice(0, 8)}`,
            avatar_url: "",
            tier: "free" as const,
            bio: "",
            created_at: new Date().toISOString(),
            birthdate: "",
            city: "",
            country: "",
            posts_count: 0,
            followers_count: 0,
            following_count: 0,
          };

          const { error: upsertError } = await supabase
            .from("profiles")
            .upsert(newProfile);

          if (upsertError) throw upsertError;

          setProfile(newProfile);
        }
      } catch (err: any) {
        console.error("Error cargando/creando perfil:", err);
        setError("No pudimos cargar tu perfil. Intenta más tarde.");
      } finally {
        setLoading(false);
      }
    };

    loadOrCreateProfile();
  }, [currentUserId]);

  const handleSave = async () => {
    if (!currentUserId) return;
    setSaving(true);

    try {
      const { error } = await supabase
        .from("profiles")
        .upsert({
          id: currentUserId,
          name: profile.name,
          bio: profile.bio,
          birthdate: profile.birthdate,
          city: profile.city,
          country: profile.country,
          avatar_url: profile.avatar_url,
        });

      if (error) throw error;

      alert("Perfil guardado correctamente ✅");
      onClose();
    } catch (err: any) {
      alert("Error al guardar: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentUserId) return;

    if (!file.type.startsWith("image/")) {
      alert("Solo se permiten imágenes (JPG, PNG, etc.)");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert("La imagen es muy grande (máximo 5 MB)");
      return;
    }

    setUploadingAvatar(true);
    const timestamp = Date.now();
    const fileName = `${currentUserId}/avatar-${timestamp}`;

    try {
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("avatars")
        .getPublicUrl(fileName);

      if (!urlData?.publicUrl) throw new Error("No se pudo obtener la URL pública del avatar");

      const newAvatarUrl = `${urlData.publicUrl}?t=${timestamp}`;

      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: newAvatarUrl })
        .eq("id", currentUserId);

      if (updateError) throw updateError;

      setProfile((prev) => ({ ...prev, avatar_url: newAvatarUrl }));
    } catch (err: any) {
      console.error("Error en avatar:", err);
      alert("No se pudo subir o asociar la imagen: " + err.message);
    } finally {
      setUploadingAvatar(false);
    }
  };

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  const joinedDate = profile.created_at
    ? new Date(profile.created_at).toLocaleDateString("es-MX", {
        month: "long",
        year: "numeric",
      })
    : "—";

  const isPremium = profile.tier === "premium" || profile.tier === "premium+";

  if (loading) {
    return <div className="p-6 text-center text-white">Cargando perfil...</div>;
  }

  if (error) {
    return (
      <div className="p-6 text-center text-red-500">
        {error}
        <button onClick={onClose}>Cerrar</button>
      </div>
    );
  }

  const handleUpgrade = async () => {
    if (!currentUserId) return;

    try {
      // FASE 5: calculo dinámico del precio según la cantidad de usuarios
      const { data: totalUsersData, error: countError } = await supabase
        .from("profiles")
        .select("id", { count: "exact", head: true });

      if (countError) throw countError;

      const totalUsers = totalUsersData?.length || 0;
      const basePrice = 10; // WLD base
      const dynamicPrice = basePrice + totalUsers * 0.01; // ejemplo: cada usuario suma 0.01 WLD

      const confirmMsg = `Precio upgrade: ${dynamicPrice.toFixed(2)} WLD. Confirmar?`;
      if (!confirm(confirmMsg)) return;

      // Aquí se podría llamar a tu función de pago WLD
      alert(`Upgrade realizado con éxito por ${dynamicPrice.toFixed(2)} WLD`);

      // Actualizar tier en perfil
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ tier: "premium" })
        .eq("id", currentUserId);

      if (updateError) throw updateError;

      setProfile((prev) => ({ ...prev, tier: "premium" }));
    } catch (err: any) {
      console.error("Error en upgrade:", err);
      alert("No se pudo completar el upgrade: " + err.message);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-900/80 flex flex-col z-50">
      <button
        onClick={toggleTheme}
        aria-label="Alternar tema claro/oscuro"
        className="absolute top-4 right-4 text-white text-2xl hover:text-yellow-300 transition-colors z-10"
      >
        {theme === "dark" ? "☀️" : "🌙"}
      </button>

      <div className="absolute -bottom-12 left-6 w-24 h-24">
        <img
          src={profile.avatar_url || "/default-avatar.png"}
          alt="Tu avatar"
          className="w-24 h-24 rounded-full border-4 border-gray-900 object-cover shadow-lg"
          onError={(e) => {
            (e.target as HTMLImageElement).src = "/default-avatar.png";
          }}
        />

        <button
          type="button"
          onClick={() => avatarInputRef.current?.click()}
          disabled={uploadingAvatar}
          className={`absolute bottom-0 right-0 bg-purple-600 text-white text-xs px-3 py-1 rounded-full cursor-pointer hover:bg-purple-700 shadow transition-all flex items-center justify-center ${
            uploadingAvatar ? "opacity-70 cursor-not-allowed" : ""
          }`}
        >
          {uploadingAvatar ? "Subiendo..." : "Cambiar"}
        </button>

        <input
          ref={avatarInputRef}
          type="file"
          accept="image/*"
          onChange={handleAvatarChange}
          className="hidden"
          disabled={uploadingAvatar}
        />
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="pt-14 px-6 pb-6">
          <input
            value={profile.name}
            onChange={(e) => setProfile({ ...profile, name: e.target.value })}
            className="bg-transparent text-2xl font-bold w-full focus:outline-none text-white"
            placeholder="Tu nombre"
            maxLength={50}
          />
          <p className="text-gray-400 mt-1">@{profile.username || "sin_username"}</p>

          {isPremium && (
            <div className="inline-block mt-2 px-4 py-1 bg-gradient-to-r from-yellow-400 to-amber-500 text-black text-xs font-bold rounded-full">
              PREMIUM
            </div>
          )}

          <textarea
            value={profile.bio}
            onChange={(e) => {
              const val = e.target.value;
              setProfile({ ...profile, bio: val });
              setBioLength(val.length);
            }}
            placeholder="Escribe tu bio..."
            maxLength={160}
            className="mt-4 w-full bg-gray-800 text-white p-4 rounded-2xl resize-none h-28 focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
          <div className="text-right text-xs text-gray-400 mt-1">{bioLength}/160</div>

          <div className="flex gap-6 mt-6 text-sm">
            <div>
              <span className="font-bold text-white">{profile.following_count}</span>{" "}
              <span className="text-gray-400">Siguiendo</span>
            </div>
            <div>
              <span className="font-bold text-white">{profile.followers_count}</span>{" "}
              <span className="text-gray-400">Seguidores</span>
            </div>
            <div className="text-gray-400">
              Se unió en <span className="text-white">{joinedDate}</span>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-4 text-sm text-gray-300">
            {(profile.city || profile.country) && (
              <div>
                📍 {profile.city}
                {profile.country ? `, ${profile.country}` : ""}
              </div>
            )}
            {profile.birthdate && (
              <div>🎂 {new Date(profile.birthdate).toLocaleDateString("es-MX")}</div>
            )}
          </div>
        </div>

        <div className="flex border-b border-white/20 sticky top-0 bg-gray-900 z-10">
          {(["posts", "responses", "likes"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-4 text-sm font-medium transition-colors ${
                activeTab === tab
                  ? "text-purple-400 border-b-4 border-purple-400"
                  : "text-gray-400 hover:text-gray-300"
              }`}
            >
              {tab === "posts" ? "Posts" : tab === "responses" ? "Respuestas" : "Likes"}
            </button>
          ))}
        </div>

        <div className="p-6">
          {activeTab === "posts" && (
            <p className="text-gray-400 text-center py-10">Tus posts aparecerán aquí</p>
          )}
          {activeTab === "responses" && (
            <p className="text-gray-400 text-center py-10">Tus respuestas aparecerán aquí</p>
          )}
          {activeTab === "likes" && (
            <p className="text-gray-400 text-center py-10">
              Posts que te gustaron aparecerán aquí
            </p>
          )}
        </div>

        <div className="p-6 border-t border-white/10 bg-gray-900/70 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Nacimiento</label>
              <input
                type="date"
                value={profile.birthdate}
                onChange={(e) => setProfile({ ...profile, birthdate: e.target.value })}
                className="w-full bg-gray-800 p-3 rounded-xl focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Ciudad</label>
              <input
                type="text"
                placeholder="Ciudad"
                value={profile.city}
                onChange={(e) => setProfile({ ...profile, city: e.target.value })}
                className="w-full bg-gray-800 p-3 rounded-xl focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1">País</label>
            <input
              type="text"
              placeholder="País"
              value={profile.country}
              onChange={(e) => setProfile({ ...profile, country: e.target.value })}
              className="w-full bg-gray-800 p-3 rounded-xl focus:outline-none"
            />
          </div>
        </div>
      </div>

      <div className="border-t border-white/10 p-4 flex gap-3 flex-shrink-0 bg-gray-900">
        {showUpgradeButton && (
          <button
            onClick={handleUpgrade} // ← fase 5 agregada aquí
            className="flex-1 py-3.5 bg-gradient-to-r from-purple-600 to-indigo-600 rounded-2xl font-medium hover:opacity-90 transition"
          >
            Upgrade
          </button>
        )}

        <button
          onClick={handleSave}
          disabled={saving}
          className="flex-1 py-3.5 bg-green-600 rounded-2xl font-medium disabled:opacity-60 hover:bg-green-700 transition"
        >
          {saving ? "Guardando..." : "Guardar cambios"}
        </button>

        <button
          onClick={() => alert("Reportado (función pendiente)")}
          className="px-6 py-3.5 bg-red-600/80 rounded-2xl text-sm font-medium hover:bg-red-700 transition"
        >
          Reportar
        </button>
      </div>
    </div>
  );
};

export default ProfileModal;
