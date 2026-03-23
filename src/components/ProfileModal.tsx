import React, { useEffect, useState, useContext } from "react";
import { supabase } from "../supabaseClient";
import { ThemeContext } from "../lib/ThemeContext";
import { MiniKit, Tokens, tokenToDecimals } from "@worldcoin/minikit-js";
import { useLanguage } from '../LanguageContext';
// npm install country-state-city
import { Country, State, City } from "country-state-city";

const RECEIVER = "0xdf4a991bc05945bd0212e773adcff6ea619f4c4b";

interface ProfileModalProps {
  id: string | null;
  onClose: () => void;
  currentUserId: string | null;
  showUpgradeButton?: boolean;
  onOpenChat?: (otherUserId: string) => void;
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
  state: string;
  country: string;
  country_selected_at: string | null;
  website: string;
  location_text: string;
  posts_count: number;
  followers_count: number;
  following_count: number;
  profile_visible: boolean;
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
  state: "",
  country: "",
  country_selected_at: null,
  website: "",
  location_text: "",
  posts_count: 0,
  followers_count: 0,
  following_count: 0,
  profile_visible: true,
};

const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

const ProfileModal: React.FC<ProfileModalProps> = ({
  id,
  onClose,
  currentUserId,
  showUpgradeButton,
  onOpenChat,
}) => {
  const { t } = useLanguage();
  const [profile, setProfile] = useState<UserProfile>(emptyProfile);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [bioLength, setBioLength] = useState(0);
  const [activeTab, setActiveTab] = useState<"info" | "location">("info");

  const [previewAvatar, setPreviewAvatar] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const [showComplaintModal, setShowComplaintModal] = useState(false);
  const [complaintMessage, setComplaintMessage] = useState("");
  const [sendingComplaint, setSendingComplaint] = useState(false);

  const { theme, username: globalUsername } = useContext(ThemeContext);
  const isOwnProfile = currentUserId === id;

  const countries = Country.getAllCountries();
  const selectedCountryObj = countries.find(c => c.isoCode === profile.country);
  const states = profile.country ? State.getStatesOfCountry(profile.country) : [];
  const selectedStateObj = states.find(s => s.isoCode === profile.state);
  const cities = profile.country && profile.state
    ? City.getCitiesOfState(profile.country, profile.state)
    : [];

  const isCountryLocked = (): boolean => {
    if (!profile.country_selected_at) return false;
    const selected = new Date(profile.country_selected_at).getTime();
    return Date.now() - selected < ONE_YEAR_MS;
  };

  const countryLockDaysLeft = (): number => {
    if (!profile.country_selected_at) return 0;
    const selected = new Date(profile.country_selected_at).getTime();
    const ms = ONE_YEAR_MS - (Date.now() - selected);
    return Math.ceil(ms / (24 * 60 * 60 * 1000));
  };

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (showComplaintModal) setShowComplaintModal(false);
        else onClose();
      }
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [onClose, showComplaintModal]);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }

    const fetchProfile = async () => {
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", id)
          .maybeSingle();

        if (error) throw error;

        const updatedProfile: UserProfile = {
          ...emptyProfile,
          ...data,
          username: data?.username || globalUsername || id.slice(0, 10),
        };

        setProfile(updatedProfile);
        setBioLength(updatedProfile.bio?.length || 0);
      } catch (err: any) {
        setToast({ message: err.message, type: "error" });
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [id, globalUsername]);

  const refreshProfile = async () => {
    if (!id) return;
    const { data } = await supabase.from("profiles").select("*").eq("id", id).maybeSingle();
    if (data) {
      setProfile({
        ...emptyProfile,
        ...data,
        username: data.username || globalUsername || id.slice(0, 10),
      });
    }
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setPreviewAvatar(URL.createObjectURL(file));
    }
  };

  const handleUploadAvatar = async () => {
    if (!selectedFile || !currentUserId || !isOwnProfile) return;
    setUploadingAvatar(true);
    try {
      const fileExt = selectedFile.name.split(".").pop() || "jpg";
      const fileName = `${currentUserId}-${Date.now()}.${fileExt}`;

      const img = document.createElement("img");
      img.src = URL.createObjectURL(selectedFile);
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });

      const canvas = document.createElement("canvas");
      const MAX = 512;
      let { width, height } = img;
      if (width > height) {
        if (width > MAX) { height *= MAX / width; width = MAX; }
      } else {
        if (height > MAX) { width *= MAX / height; height = MAX; }
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx?.drawImage(img, 0, 0, width, height);

      const compressedBlob: Blob = await new Promise((resolve, reject) => {
        canvas.toBlob(blob => {
          if (blob) resolve(blob);
          else reject(new Error("Error comprimiendo imagen"));
        }, "image/jpeg", 0.8);
      });

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(fileName, compressedBlob, { upsert: true });
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from("avatars").getPublicUrl(fileName);
      const publicUrl = data.publicUrl;

      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: publicUrl })
        .eq("id", currentUserId);
      if (updateError) throw updateError;

      setProfile((prev: any) => ({ ...prev, avatar_url: publicUrl }));
      setPreviewAvatar(null);
      setSelectedFile(null);
      setToast({ message: t("avatar_subido_exito"), type: "success" });
    } catch (err: any) {
      setToast({ message: err.message || t("error_subir_avatar"), type: "error" });
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSave = async () => {
    if (!currentUserId) {
      setToast({ message: "No se encontró userId", type: "error" });
      return;
    }

    setSaving(true);
    try {
      const isChangingCountry = profile.country && !isCountryLocked();
      const updatePayload: any = {
        name: profile.name,
        bio: profile.bio,
        birthdate: profile.birthdate,
        city: profile.city,
        state: profile.state,
        country: profile.country,
        location_text: profile.location_text,
        profile_visible: profile.profile_visible,
      };

      if (isChangingCountry && profile.country) {
        updatePayload.country_selected_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from("profiles")
        .update(updatePayload)
        .eq("id", currentUserId);

      if (error) throw error;

      await refreshProfile();
      setToast({ message: t("perfil_guardado"), type: "success" });
    } catch (err: any) {
      setToast({ message: t("error_guardar") + ": " + (err.message || "desconocido"), type: "error" });
    } finally {
      setSaving(false);
    }
  };

  const handleSendComplaint = async () => {
    if (!complaintMessage.trim()) return;
    setSendingComplaint(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();

      const res = await fetch(
        "https://vtjqfzpfehfofamhowjz.supabase.co/functions/v1/send-complaint",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${session?.access_token ?? import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            "apikey": import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({
            message: complaintMessage,
            userId: currentUserId,
            username: profile.username,
          }),
        }
      );

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Error al enviar");
      }

      setToast({ message: t("queja_enviada") || "Mensaje enviado correctamente", type: "success" });
      setComplaintMessage("");
      setShowComplaintModal(false);
    } catch (err: any) {
      setToast({ message: err.message || "Error al enviar mensaje", type: "error" });
    } finally {
      setSendingComplaint(false);
    }
  };

  const toggleProfileVisibility = () => {
    setProfile(prev => ({ ...prev, profile_visible: !prev.profile_visible }));
  };

  const handlePremiumChat = async () => {
    if (!currentUserId) {
      setToast({ message: t("id_no_encontrado"), type: "error" });
      return;
    }
    if (profile.tier === "premium" || profile.tier === "premium+") {
      window.location.href = "/chat/premium";
      return;
    }
    try {
      if (!MiniKit.isInstalled()) throw new Error(t("minikit_no_detectado"));
      const payRes = await MiniKit.commandsAsync.pay({
        reference: "premium-chat-" + Date.now(),
        to: RECEIVER,
        tokens: [{ symbol: Tokens.WLD, token_amount: tokenToDecimals(5, Tokens.WLD).toString() }],
        description: t("suscripcion_chat_exclusivo"),
      });
      if (payRes?.finalPayload?.status !== "success") throw new Error(t("pago_cancelado"));
      await fetch("/api/subscribePremiumChat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: currentUserId,
          transactionId: payRes.finalPayload.transaction_id,
        }),
      });
      setToast({ message: t("suscripcion_exitosa"), type: "success" });
      window.location.href = "/chat/premium";
    } catch (err: any) {
      setToast({ message: err.message || t("error_pago"), type: "error" });
    }
  };

  const tierColors: Record<string, string> = {
    "premium+": "bg-yellow-500 text-black",
    "premium": "bg-purple-600 text-white",
    "basic": "bg-blue-600 text-white",
    "free": "bg-gray-600 text-white",
  };

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-start justify-center z-50 px-2 overflow-y-auto pt-6 pb-10"
        onClick={onClose}
      >
        <div
          className="bg-gray-950 rounded-3xl w-full max-w-lg border border-white/10 relative overflow-hidden shadow-2xl"
          onClick={e => e.stopPropagation()}
        >
          {/* Cover / Header gradient */}
          <div className="h-28 bg-gradient-to-br from-purple-900 via-indigo-900 to-gray-900 relative">
            <button
              onClick={onClose}
              className="absolute top-3 right-3 bg-black/40 hover:bg-black/60 text-white rounded-full w-8 h-8 flex items-center justify-center text-lg transition"
              aria-label={t("cerrar_modal")}
            >
              ×
            </button>
            <span
              className={`absolute top-3 left-3 px-3 py-1 text-xs font-bold rounded-full ${tierColors[profile.tier] || tierColors["free"]}`}
            >
              {profile.tier.toUpperCase()}
            </span>
          </div>

          {/* Avatar overlapping cover */}
          <div className="px-5 pb-0">
            <div className="flex items-end justify-between -mt-14 mb-3">
              <div className="relative">
                <div className="w-24 h-24 rounded-full border-4 border-gray-950 overflow-hidden bg-gray-800 shadow-xl">
                  {uploadingAvatar && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-20 rounded-full">
                      <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-purple-500" />
                    </div>
                  )}
                  <img
                    src={previewAvatar || profile.avatar_url || "/default-avatar.png"}
                    alt="Avatar"
                    className="w-full h-full object-cover"
                  />
                </div>
                {isOwnProfile && (
                  <div className="absolute bottom-0 right-0 w-7 h-7 z-10">
                    <div className="bg-purple-600 rounded-full w-7 h-7 flex items-center justify-center shadow-md pointer-events-none">
                      <span className="text-xs">✏️</span>
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarChange}
                      disabled={uploadingAvatar}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                  </div>
                )}
              </div>

              {previewAvatar && isOwnProfile && (
                <div className="flex gap-2 mt-10">
                  <button
                    onClick={() => { setPreviewAvatar(null); setSelectedFile(null); }}
                    className="px-3 py-1.5 bg-gray-700 text-white text-sm rounded-full hover:bg-gray-600 transition"
                  >
                    {t("cancelar")}
                  </button>
                  <button
                    onClick={handleUploadAvatar}
                    disabled={uploadingAvatar}
                    className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-sm rounded-full disabled:opacity-50 transition"
                  >
                    {uploadingAvatar ? t("subiendo") : t("guardar_avatar")}
                  </button>
                </div>
              )}
            </div>

            {/* Name & username */}
            {loading ? (
              <p className="text-white text-center py-8">{t("cargando_perfil")}</p>
            ) : (
              <>
                <div className="mb-1">
                  <p className="text-white text-lg font-bold leading-tight">@{profile.username}</p>
                  {profile.name ? <p className="text-gray-400 text-sm">{profile.name}</p> : null}
                </div>

                {/* Bio preview (when not empty) */}
                {profile.bio ? (
                  <p className="text-gray-300 text-sm mb-2 leading-snug">{profile.bio}</p>
                ) : null}

                {/* Location quick info */}
                {(profile.city || selectedCountryObj?.name) && (
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 mb-4">
                    <span>📍 {[profile.city, selectedCountryObj?.name].filter(Boolean).join(", ")}</span>
                  </div>
                )}

                {/* Stats row */}
                <div className="flex gap-6 text-center border-y border-white/10 py-3 mb-5">
                  <div>
                    <p className="text-white font-bold text-base">{profile.posts_count}</p>
                    <p className="text-gray-500 text-xs">{t("publicaciones") || "Posts"}</p>
                  </div>
                  <div>
                    <p className="text-white font-bold text-base">{profile.followers_count}</p>
                    <p className="text-gray-500 text-xs">{t("seguidores") || "Seguidores"}</p>
                  </div>
                  <div>
                    <p className="text-white font-bold text-base">{profile.following_count}</p>
                    <p className="text-gray-500 text-xs">{t("siguiendo") || "Siguiendo"}</p>
                  </div>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-white/10 mb-5">
                  <button
                    className={`flex-1 pb-2 text-sm font-medium transition ${activeTab === "info" ? "text-purple-400 border-b-2 border-purple-500" : "text-gray-500 hover:text-gray-300"}`}
                    onClick={() => setActiveTab("info")}
                  >
                    {t("informacion") || "Información"}
                  </button>
                  <button
                    className={`flex-1 pb-2 text-sm font-medium transition ${activeTab === "location" ? "text-purple-400 border-b-2 border-purple-500" : "text-gray-500 hover:text-gray-300"}`}
                    onClick={() => setActiveTab("location")}
                  >
                    {t("ubicacion") || "Ubicación"}
                  </button>
                </div>

                {/* ── TAB: INFO ── */}
                {activeTab === "info" && (
                  <div className="space-y-4 pb-2">
                    {/* Nombre visible */}
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">{t("nombre") || "Nombre visible"}</label>
                      <input
                        type="text"
                        value={profile.name}
                        onChange={e => setProfile(prev => ({ ...prev, name: e.target.value }))}
                        className="w-full bg-gray-900 border border-white/10 p-3 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                        placeholder={t("tu_nombre") || "Tu nombre"}
                      />
                    </div>

                    {/* Bio */}
                    <div>
                      <div className="flex justify-between mb-1">
                        <label className="text-xs text-gray-500">{t("biografia") || "Biografía"}</label>
                        <span className="text-xs text-gray-600">{bioLength}/160</span>
                      </div>
                      <textarea
                        value={profile.bio}
                        onChange={e => {
                          if (e.target.value.length <= 160) {
                            setProfile(prev => ({ ...prev, bio: e.target.value }));
                            setBioLength(e.target.value.length);
                          }
                        }}
                        className="w-full bg-gray-900 border border-white/10 p-3 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none h-20"
                        placeholder={t("cuentanos_sobre_ti") || "Cuéntanos sobre ti..."}
                      />
                    </div>

                    {/* Fecha de nacimiento */}
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">{t("fecha_nacimiento")}</label>
                      <input
                        type="date"
                        value={profile.birthdate}
                        onChange={e => setProfile(prev => ({ ...prev, birthdate: e.target.value }))}
                        className="w-full bg-gray-900 border border-white/10 p-3 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    </div>

                    {/* Perfil visible */}
                    <div className="flex items-center justify-between bg-gray-900 border border-white/10 rounded-xl px-4 py-3">
                      <label className="text-sm text-gray-300">{t("perfil_visible") || "Perfil visible"}</label>
                      <button
                        onClick={toggleProfileVisibility}
                        className={`relative w-11 h-6 rounded-full transition-colors ${profile.profile_visible ? "bg-purple-600" : "bg-gray-700"}`}
                      >
                        <span
                          className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${profile.profile_visible ? "translate-x-5" : "translate-x-0"}`}
                        />
                      </button>
                    </div>
                  </div>
                )}

                {/* ── TAB: UBICACIÓN ── */}
                {activeTab === "location" && (
                  <div className="space-y-4 pb-2">
                    {/* Texto libre de ubicación */}
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">{t("ubicacion_texto") || "Descripción de ubicación"}</label>
                      <input
                        type="text"
                        value={profile.location_text}
                        onChange={e => setProfile(prev => ({ ...prev, location_text: e.target.value }))}
                        className="w-full bg-gray-900 border border-white/10 p-3 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                        placeholder={t("ej_ciudad_creativa") || "ej. Ciudad de México, CDMX"}
                      />
                    </div>

                    {/* País */}
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">{t("pais") || "País"}</label>
                      {isCountryLocked() ? (
                        <div className="w-full bg-gray-900 border border-white/10 p-3 rounded-xl text-gray-400 text-sm flex items-center justify-between">
                          <span>{selectedCountryObj?.name || profile.country}</span>
                          <span className="text-xs text-orange-400 ml-2">
                            🔒 {countryLockDaysLeft()} {t("dias_restantes") || "días restantes"}
                          </span>
                        </div>
                      ) : (
                        <select
                          value={profile.country}
                          onChange={e => setProfile(prev => ({
                            ...prev,
                            country: e.target.value,
                            state: "",
                            city: "",
                          }))}
                          className="w-full bg-gray-900 border border-white/10 p-3 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                        >
                          <option value="">{t("seleccionar_pais") || "Seleccionar país"}</option>
                          {countries.map(c => (
                            <option key={c.isoCode} value={c.isoCode}>{c.name}</option>
                          ))}
                        </select>
                      )}
                    </div>

                    {/* Estado */}
                    {states.length > 0 && (
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">{t("estado") || "Estado / Provincia"}</label>
                        <select
                          value={profile.state}
                          onChange={e => setProfile(prev => ({ ...prev, state: e.target.value, city: "" }))}
                          className="w-full bg-gray-900 border border-white/10 p-3 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                        >
                          <option value="">{t("seleccionar_estado") || "Seleccionar estado"}</option>
                          {states.map(s => (
                            <option key={s.isoCode} value={s.isoCode}>{s.name}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* Ciudad */}
                    {cities.length > 0 && (
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">{t("ciudad") || "Ciudad"}</label>
                        <select
                          value={profile.city}
                          onChange={e => setProfile(prev => ({ ...prev, city: e.target.value }))}
                          className="w-full bg-gray-900 border border-white/10 p-3 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                        >
                          <option value="">{t("seleccionar_ciudad") || "Seleccionar ciudad"}</option>
                          {cities.map(c => (
                            <option key={c.name} value={c.name}>{c.name}</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                )}

                {/* Save button (own profile only) */}
                {isOwnProfile && (
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="w-full mt-4 mb-2 py-3 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-semibold rounded-2xl transition text-sm"
                  >
                    {saving ? t("guardando") || "Guardando..." : t("guardar_cambios") || "Guardar cambios"}
                  </button>
                )}

                {/* Premium chat button */}
                {showUpgradeButton && (
                  <button
                    onClick={handlePremiumChat}
                    className="w-full mb-2 py-3 bg-gradient-to-r from-yellow-500 to-amber-500 text-black font-semibold rounded-2xl transition text-sm"
                  >
                    {t("chat_premium") || "Chat Premium"}
                  </button>
                )}

                {/* Complaint button */}
                {!isOwnProfile && (
                  <button
                    onClick={() => setShowComplaintModal(true)}
                    className="w-full mb-4 py-2.5 border border-white/10 text-gray-400 hover:text-gray-200 hover:border-white/20 font-medium rounded-2xl transition text-sm"
                  >
                    {t("enviar_queja") || "Enviar queja"}
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div
          className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[200] px-5 py-3 rounded-2xl text-sm font-semibold shadow-2xl border transition-all ${
            toast.type === "success"
              ? "bg-green-900/90 border-green-500/40 text-green-200"
              : "bg-red-900/90 border-red-500/40 text-red-200"
          }`}
        >
          {toast.message}
        </div>
      )}

      {/* Complaint modal */}
      {showComplaintModal && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[100] px-4"
          onClick={() => setShowComplaintModal(false)}
        >
          <div
            className="bg-gray-950 rounded-3xl w-full max-w-sm border border-white/10 p-6 shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="text-white font-bold text-base mb-1">{t("enviar_queja") || "Enviar queja"}</h3>
            <p className="text-gray-500 text-xs mb-4">{t("queja_descripcion") || "Describe tu problema o queja."}</p>
            <textarea
              value={complaintMessage}
              onChange={e => setComplaintMessage(e.target.value)}
              rows={4}
              className="w-full bg-gray-900 border border-white/10 p-3 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none mb-4"
              placeholder={t("escribe_tu_mensaje") || "Escribe tu mensaje..."}
            />
            <div className="flex gap-2">
              <button
                onClick={() => setShowComplaintModal(false)}
                className="flex-1 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 font-medium rounded-xl transition text-sm"
              >
                {t("cancelar") || "Cancelar"}
              </button>
              <button
                onClick={handleSendComplaint}
                disabled={sendingComplaint || !complaintMessage.trim()}
                className="flex-1 py-2.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-semibold rounded-xl transition text-sm"
              >
                {sendingComplaint ? t("enviando") || "Enviando..." : t("enviar") || "Enviar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ProfileModal;
