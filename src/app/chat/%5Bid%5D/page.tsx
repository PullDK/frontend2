"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { collection, onSnapshot, orderBy, query, addDoc, serverTimestamp, doc, updateDoc, getDoc, setDoc, deleteField, getDocs, where, limit, increment } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth";

type Message = {
  id?: string;
  from: string;
  text: string;
  createdAt?: any;
};

export default function ChatPage() {
  const params = useParams();
  const chatId = params?.id as string;
  const { user, configured, logout } = useAuth();
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileInfo, setProfileInfo] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [photoURL, setPhotoURL] = useState("");
  const [about, setAbout] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  // Modal de visualização de perfil de outro membro (somente leitura)
  const [viewProfileOpen, setViewProfileOpen] = useState(false);
  const [viewProfileUid, setViewProfileUid] = useState<string | null>(null);
  const [viewProfileLoading, setViewProfileLoading] = useState(false);
  const [viewProfileError, setViewProfileError] = useState<string | null>(null);
  const [viewProfile, setViewProfile] = useState<{ displayName?: string | null; photoURL?: string | null; email?: string | null; about?: string | null } | null>(null);
  // Participantes do chat e título amigável
  type Participant = { displayName?: string | null; email?: string | null; photoURL?: string | null; cosmetics?: Cosmetics };
  const [participants, setParticipants] = useState<Record<string, Participant>>({});
  const [chatTitle, setChatTitle] = useState<string>("Chat");
  // Metadados do grupo
  const [chatType, setChatType] = useState<"private" | "group" | undefined>(undefined);
  const [groupPhotoURL, setGroupPhotoURL] = useState<string | null>(null);
  const [groupOwner, setGroupOwner] = useState<string | null>(null);
  const [groupMembers, setGroupMembers] = useState<string[]>([]);
  const [groupAdmins, setGroupAdmins] = useState<string[]>([]);
  const [groupSettingsOpen, setGroupSettingsOpen] = useState(false);
  const [groupSettingsError, setGroupSettingsError] = useState<string | null>(null);
  const [groupSettingsSaving, setGroupSettingsSaving] = useState(false);
  const [addMemberEmail, setAddMemberEmail] = useState("");
  const [addMemberSearching, setAddMemberSearching] = useState(false);
  const [emailSuggesting, setEmailSuggesting] = useState(false);
  const [emailSuggestions, setEmailSuggestions] = useState<Array<{ uid: string; email?: string | null; displayName?: string | null; photoURL?: string | null }>>([]);
  // Seleção múltipla de anexos (imagem, vídeo, áudio)
  type PendingItem = { file: File; kind: "image" | "video" | "audio" | "file"; previewUrl?: string | null };
  const [pendingItems, setPendingItems] = useState<PendingItem[]>([]);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const currentUploadXhr = useRef<Record<string, XMLHttpRequest>>({});
  // Gravação de áudio
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recordedChunksRef = useRef<BlobPart[]>([]);
  const shouldSaveRecordingRef = useRef(true);
  // Menu de ações (reagir/responder) e resposta
  const [actionMenu, setActionMenu] = useState<{ messageId: string; x: number; y: number } | null>(null);
  const longPressTimerRef = useRef<number | null>(null);
  const [replyTo, setReplyTo] = useState<any | null>(null);
  // Mapear cada mensagem para o elemento na lista (para scroll e destaque)
  const messageItemRefs = useRef<Record<string, HTMLDivElement | null>>({});
  // Cosméticos (loja): agora com ~10 opções por categoria e animações simples
  type Cosmetics = {
    // Avatar
    avatarStyle?: "none" | "rgb" | "gold" | "neon" | "sunset" | "ocean" | "forest" | "candy" | "galaxy" | "matrix" | "fire";
    avatarAnim?: "none" | "pulse" | "spin";
    // Nome
    nameStyle?: "green" | "blue" | "purple" | "rgb" | "rose" | "cyan" | "orange" | "lime" | "sky" | "fuchsia" | "amber" | "teal" | "indigo";
    nameAnim?: "none" | "pulse" | "gradient";
    // Badge
    badge?: "none" | "crown" | "star" | "flame" | "bolt" | "diamond" | "heart" | "rocket" | "ghost" | "music" | "coffee"
      | "trophy" | "medal" | "sparkles" | "balloon" | "gift" | "skull" | "snowflake" | "sun" | "moon" | "leaf" | "alien" | "ufo";
    badgeAnim?: "none" | "bounce" | "pulse" | "spin" | "wiggle" | "float" | "beat" | "flicker" | "twinkle";
    // Bolha de mensagem
    bubbleStyle?: "default" | "rounded_md" | "rounded_xl" | "glass" | "glow" | "wireframe" | "shadow" | "neon_purple" | "denim" | "outline_thick" | "gradient_surface"
      | "neon_blue" | "neon_green" | "neon_pink" | "neon_yellow" | "neon_red" | "neon_cyan" | "neon_rainbow" | "glass_blue" | "glass_purple" | "outline_glow_blue" | "outline_glow_pink" | "wireframe_dotted" | "stripes" | "grid";
    bubbleAnim?: "none" | "pulse" | "flicker" | "breath";
    // Modal de perfil
    modalBg?: "surface" | "glass" | "gradient_emerald" | "gradient_night" | "pattern_dots" | "pattern_grid" | "pattern_stripes";
    modalFrame?: "border" | "rounded_xl" | "wireframe" | "neon_emerald" | "neon_violet";
    modalAccent?: "emerald" | "violet" | "cyan" | "rose" | "amber" | "indigo";
  };
  const [cosmetics, setCosmetics] = useState<Cosmetics>({
    avatarStyle: "none",
    avatarAnim: "none",
    nameStyle: "green",
    nameAnim: "none",
    badge: "none",
    badgeAnim: "none",
    bubbleStyle: "default",
    bubbleAnim: "none",
    modalBg: "surface",
    modalFrame: "border",
    modalAccent: "emerald",
  });
  useEffect(() => {
    try {
      const raw = localStorage.getItem("dkchat.cosmetics");
      if (raw) {
        const c = JSON.parse(raw);
        setCosmetics({
          avatarStyle: c?.avatarStyle || "none",
          avatarAnim: c?.avatarAnim || "none",
          nameStyle: c?.nameStyle || "green",
          nameAnim: c?.nameAnim || "none",
          badge: c?.badge || "none",
          badgeAnim: c?.badgeAnim || "none",
        bubbleStyle: c?.bubbleStyle || "default",
        bubbleAnim: c?.bubbleAnim || "none",
        modalBg: c?.modalBg || "surface",
        modalFrame: c?.modalFrame || "border",
        modalAccent: c?.modalAccent || "emerald",
      });
      }
    } catch {}
    const handler = () => {
      try {
        const raw = localStorage.getItem("dkchat.cosmetics");
        const c = raw ? JSON.parse(raw) : {};
        setCosmetics({
          avatarStyle: c?.avatarStyle || "none",
          avatarAnim: c?.avatarAnim || "none",
          nameStyle: c?.nameStyle || "green",
          nameAnim: c?.nameAnim || "none",
          badge: c?.badge || "none",
          badgeAnim: c?.badgeAnim || "none",
        bubbleStyle: c?.bubbleStyle || "default",
        bubbleAnim: c?.bubbleAnim || "none",
        modalBg: c?.modalBg || "surface",
        modalFrame: c?.modalFrame || "border",
        modalAccent: c?.modalAccent || "emerald",
      });
      } catch {}
    };
    window.addEventListener("dkchat:cosmetics-updated", handler as any);
    return () => window.removeEventListener("dkchat:cosmetics-updated", handler as any);
  }, []);

  function nameColorClassFor(uid: string) {
    const style = (participants[uid]?.cosmetics?.nameStyle as Cosmetics["nameStyle"]) ?? (uid === user?.uid ? cosmetics.nameStyle : "green");
    const anim = (participants[uid]?.cosmetics?.nameAnim as Cosmetics["nameAnim"]) ?? (uid === user?.uid ? cosmetics.nameAnim : "none");
    const animCls = anim === "pulse" ? " animate-pulse" : anim === "gradient" ? " animate-gradient-x bg-[length:200%_200%]" : "";
    switch (style) {
      case "rgb":
        return "bg-gradient-to-r from-pink-500 via-yellow-500 to-indigo-500 bg-clip-text text-transparent" + animCls;
      case "blue":
        return "text-blue-400" + animCls;
      case "purple":
        return "text-violet-400" + animCls;
      case "rose":
        return "text-rose-400" + animCls;
      case "cyan":
        return "text-cyan-400" + animCls;
      case "orange":
        return "text-orange-400" + animCls;
      case "lime":
        return "text-lime-400" + animCls;
      case "sky":
        return "text-sky-400" + animCls;
      case "fuchsia":
        return "text-fuchsia-400" + animCls;
      case "amber":
        return "text-amber-400" + animCls;
      case "teal":
        return "text-teal-400" + animCls;
      case "indigo":
        return "text-indigo-400" + animCls;
      default:
        return "text-emerald-400" + animCls;
    }
  }
  // Renderiza avatar com moldura; para RGB+spin usa anel girando que não rotaciona a imagem
  function avatarElFor(uid: string, url: string, sizeCls: string = "w-8 h-8") {
    const style = (participants[uid]?.cosmetics?.avatarStyle as Cosmetics["avatarStyle"]) ?? (uid === user?.uid ? cosmetics.avatarStyle : "none");
    const anim = (participants[uid]?.cosmetics?.avatarAnim as Cosmetics["avatarAnim"]) ?? (uid === user?.uid ? cosmetics.avatarAnim : "none");
    if (style === "rgb" && anim === "spin") {
      return (
        <div className={`relative inline-block overflow-hidden rounded-full ${sizeCls}`}>
          <span className="absolute inset-0 rounded-full animate-[spin_3s_linear_infinite] bg-[conic-gradient(from_0deg,_#ec4899,_#f59e0b,_#6366f1,_#ec4899)]" />
          <img src={url} alt={"Avatar"} className="absolute inset-[2px] rounded-full object-cover border border-transparent" />
        </div>
      );
    }
    return (
      <div className={avatarWrapperClassFor(uid)}>
        <img src={url} alt={"Avatar"} className={`${sizeCls} rounded-full object-cover border border-transparent`} />
      </div>
    );
  }
  function avatarWrapperClassFor(uid: string) {
    const style = (participants[uid]?.cosmetics?.avatarStyle as Cosmetics["avatarStyle"]) ?? (uid === user?.uid ? cosmetics.avatarStyle : "none");
    const anim = (participants[uid]?.cosmetics?.avatarAnim as Cosmetics["avatarAnim"]) ?? (uid === user?.uid ? cosmetics.avatarAnim : "none");
    const animCls = anim === "pulse" ? " animate-pulse" : anim === "spin" ? " animate-spin" : "";
    switch (style) {
      case "rgb":
        return "p-[2px] rounded-full bg-gradient-to-r from-pink-500 via-yellow-500 to-indigo-500" + animCls;
      case "gold":
        return "p-[2px] rounded-full bg-gradient-to-r from-yellow-400 to-amber-600" + animCls;
      case "neon":
        return "p-[2px] rounded-full bg-gradient-to-r from-cyan-400 to-fuchsia-500" + animCls;
      case "sunset":
        return "p-[2px] rounded-full bg-gradient-to-r from-orange-400 via-pink-500 to-purple-600" + animCls;
      case "ocean":
        return "p-[2px] rounded-full bg-gradient-to-r from-sky-400 via-cyan-500 to-blue-600" + animCls;
      case "forest":
        return "p-[2px] rounded-full bg-gradient-to-r from-emerald-400 via-green-500 to-lime-600" + animCls;
      case "candy":
        return "p-[2px] rounded-full bg-gradient-to-r from-pink-400 via-rose-500 to-amber-400" + animCls;
      case "galaxy":
        return "p-[2px] rounded-full bg-gradient-to-r from-indigo-500 via-fuchsia-500 to-violet-600" + animCls;
      case "matrix":
        return "p-[2px] rounded-full bg-gradient-to-r from-lime-400 via-emerald-500 to-green-600" + animCls;
      case "fire":
        return "p-[2px] rounded-full bg-gradient-to-r from-red-500 via-orange-500 to-amber-500" + animCls;
      default:
        return "";
    }
  }

  function badgeElFor(uid: string) {
    const badge = (participants[uid]?.cosmetics?.badge as Cosmetics["badge"]) ?? (uid === user?.uid ? cosmetics.badge : "none");
    const anim = (participants[uid]?.cosmetics?.badgeAnim as Cosmetics["badgeAnim"]) ?? (uid === user?.uid ? cosmetics.badgeAnim : "none");
    const animCls =
      anim === "bounce" ? " animate-bounce" :
      anim === "pulse" ? " animate-pulse" :
      anim === "spin" ? " animate-spin" :
      anim === "wiggle" ? " animate-wiggle" :
      anim === "float" ? " animate-float" :
      anim === "beat" ? " animate-beat" :
      anim === "flicker" ? " animate-flicker" :
      anim === "twinkle" ? " animate-twinkle" : "";
    const cls = "ml-1 align-middle" + animCls;
    switch (badge) {
      case "crown":
        return <span className={cls} aria-label="coroa">👑</span>;
      case "star":
        return <span className={cls} aria-label="estrela">⭐</span>;
      case "flame":
        return <span className={cls} aria-label="chama">🔥</span>;
      case "bolt":
        return <span className={cls} aria-label="raio">⚡</span>;
      case "diamond":
        return <span className={cls} aria-label="diamante">💎</span>;
      case "heart":
        return <span className={cls} aria-label="coração">❤️</span>;
      case "rocket":
        return <span className={cls} aria-label="foguete">🚀</span>;
      case "ghost":
        return <span className={cls} aria-label="fantasma">👻</span>;
      case "music":
        return <span className={cls} aria-label="música">🎵</span>;
      case "coffee":
        return <span className={cls} aria-label="café">☕</span>;
      case "trophy":
        return <span className={cls} aria-label="troféu">🏆</span>;
      case "medal":
        return <span className={cls} aria-label="medalha">🥇</span>;
      case "sparkles":
        return <span className={cls} aria-label="brilhos">✨</span>;
      case "balloon":
        return <span className={cls} aria-label="balão">🎈</span>;
      case "gift":
        return <span className={cls} aria-label="presente">🎁</span>;
      case "skull":
        return <span className={cls} aria-label="caveira">💀</span>;
      case "snowflake":
        return <span className={cls} aria-label="floco de neve">❄️</span>;
      case "sun":
        return <span className={cls} aria-label="sol">☀️</span>;
      case "moon":
        return <span className={cls} aria-label="lua">🌙</span>;
      case "leaf":
        return <span className={cls} aria-label="folha">🍃</span>;
      case "alien":
        return <span className={cls} aria-label="alien">👽</span>;
      case "ufo":
        return <span className={cls} aria-label="ufo">🛸</span>;
      default:
        return null;
    }
  }

  function bubbleClassesFor(uid: string, isMine: boolean) {
    const style = (participants[uid]?.cosmetics?.bubbleStyle as Cosmetics["bubbleStyle"]) ?? (uid === user?.uid ? cosmetics.bubbleStyle : "default");
    const anim = (participants[uid]?.cosmetics?.bubbleAnim as Cosmetics["bubbleAnim"]) ?? (uid === user?.uid ? cosmetics.bubbleAnim : "none");
    let base = isMine ? "inline-block px-3 py-2 text-white bg-primary" : "inline-block px-3 py-2 bg-surface text-foreground border border-border";
    let rounded = "rounded-lg";
    let extra = "";
    switch (style) {
      case "rounded_md":
        rounded = "rounded-md";
        break;
      case "rounded_xl":
        rounded = "rounded-xl";
        break;
      case "glass":
        rounded = "rounded-lg";
        extra = isMine ? "" : "backdrop-blur bg-white/5 border border-white/10";
        break;
      case "glow":
        extra = isMine ? "shadow-[0_0_10px_rgba(99,102,241,0.45)] ring-1 ring-indigo-500/60" : "shadow-[0_0_10px_rgba(16,185,129,0.45)] ring-1 ring-emerald-500/50";
        break;
      case "wireframe":
        extra = "border-2 border-dashed";
        break;
      case "shadow":
        extra = "shadow-lg";
        break;
      case "neon_purple":
        extra = "ring-1 ring-violet-500/60 shadow-[0_0_10px_rgba(139,92,246,0.45)]";
        break;
      case "denim":
        extra = "border border-sky-600 ring-1 ring-sky-500/40";
        break;
      case "outline_thick":
        extra = "border-2";
        break;
      case "gradient_surface":
        base = isMine ? "inline-block px-3 py-2 text-white bg-gradient-to-br from-indigo-500 to-emerald-500" : "inline-block px-3 py-2 bg-gradient-to-br from-indigo-500/10 to-emerald-500/10 text-foreground border border-white/10";
        break;
      // Novos temas neon/multicolor
      case "neon_blue":
        extra = "ring-1 ring-blue-500/60 shadow-[0_0_14px_rgba(59,130,246,0.55)]";
        break;
      case "neon_green":
        extra = "ring-1 ring-emerald-500/60 shadow-[0_0_14px_rgba(16,185,129,0.55)]";
        break;
      case "neon_pink":
        extra = "ring-1 ring-pink-500/60 shadow-[0_0_14px_rgba(236,72,153,0.55)]";
        break;
      case "neon_yellow":
        extra = "ring-1 ring-amber-500/60 shadow-[0_0_14px_rgba(245,158,11,0.55)]";
        break;
      case "neon_red":
        extra = "ring-1 ring-red-500/60 shadow-[0_0_14px_rgba(239,68,68,0.55)]";
        break;
      case "neon_cyan":
        extra = "ring-1 ring-cyan-500/60 shadow-[0_0_14px_rgba(14,165,233,0.55)]";
        break;
      case "neon_rainbow":
        base = isMine ? "inline-block px-3 py-2 text-white bg-gradient-to-r from-pink-500 via-yellow-500 to-indigo-500" : "inline-block px-3 py-2 bg-gradient-to-r from-pink-500/10 via-yellow-500/10 to-indigo-500/10 text-foreground";
        extra = "ring-1 ring-white/20 shadow-[0_0_14px_rgba(255,255,255,0.35)]";
        break;
      case "glass_blue":
        extra = "backdrop-blur bg-blue-500/10 border border-blue-300/20";
        break;
      case "glass_purple":
        extra = "backdrop-blur bg-violet-500/10 border border-violet-300/20";
        break;
      case "outline_glow_blue":
        extra = "border-2 border-blue-500 ring-1 ring-blue-500/40 shadow-[0_0_10px_rgba(59,130,246,0.45)]";
        break;
      case "outline_glow_pink":
        extra = "border-2 border-pink-500 ring-1 ring-pink-500/40 shadow-[0_0_10px_rgba(236,72,153,0.45)]";
        break;
      case "wireframe_dotted":
        extra = "border-2 border-dotted";
        break;
      case "stripes":
        base = isMine ? "inline-block px-3 py-2 text-white bg-[repeating-linear-gradient(45deg,_rgba(255,255,255,0.12)_0,_rgba(255,255,255,0.12)_8px,_transparent_8px,_transparent_16px)] bg-primary" : "inline-block px-3 py-2 bg-[repeating-linear-gradient(45deg,_rgba(255,255,255,0.08)_0,_rgba(255,255,255,0.08)_8px,_transparent_8px,_transparent_16px)] text-foreground border border-border";
        break;
      case "grid":
        base = isMine ? "inline-block px-3 py-2 text-white bg-[linear-gradient(#ffffff1f_1px,transparent_1px),linear-gradient(90deg,#ffffff1f_1px,transparent_1px)] bg-[size:12px_12px] bg-primary" : "inline-block px-3 py-2 bg-[linear-gradient(#ffffff0f_1px,transparent_1px),linear-gradient(90deg,#ffffff0f_1px,transparent_1px)] bg-[size:12px_12px] text-foreground border border-border";
        break;
    }
    const animCls = anim === "pulse" ? " animate-pulse" : anim === "flicker" ? " animate-flicker" : anim === "breath" ? " animate-breath" : "";
    return `${base} ${rounded} ${extra}${animCls}`.trim();
  }

  // Classes para a modal de perfil (container principal)
  function modalContainerClassFor(uid: string) {
    const bg = (participants[uid]?.cosmetics?.modalBg as Cosmetics["modalBg"]) ?? (uid === user?.uid ? cosmetics.modalBg : "surface");
    const frame = (participants[uid]?.cosmetics?.modalFrame as Cosmetics["modalFrame"]) ?? (uid === user?.uid ? cosmetics.modalFrame : "border");
    const accent = (participants[uid]?.cosmetics?.modalAccent as Cosmetics["modalAccent"]) ?? (uid === user?.uid ? cosmetics.modalAccent : "emerald");
    const accentRing =
      accent === "violet" ? "ring-violet-500/60 shadow-[0_0_12px_rgba(139,92,246,0.35)]" :
      accent === "cyan" ? "ring-cyan-500/60 shadow-[0_0_12px_rgba(6,182,212,0.35)]" :
      accent === "rose" ? "ring-rose-500/60 shadow-[0_0_12px_rgba(244,63,94,0.35)]" :
      accent === "amber" ? "ring-amber-500/60 shadow-[0_0_12px_rgba(245,158,11,0.35)]" :
      accent === "indigo" ? "ring-indigo-500/60 shadow-[0_0_12px_rgba(79,70,229,0.35)]" :
      "ring-emerald-500/60 shadow-[0_0_12px_rgba(16,185,129,0.35)]";

    const bgCls =
      bg === "glass" ? "backdrop-blur bg-white/10" :
      bg === "gradient_emerald" ? "bg-gradient-to-br from-emerald-950/70 via-emerald-800/40 to-emerald-700/30" :
      bg === "gradient_night" ? "bg-gradient-to-br from-slate-950/70 via-indigo-900/40 to-violet-900/30" :
      bg === "pattern_dots" ? "bg-[radial-gradient(circle_at_1px_1px,_rgba(255,255,255,0.08)_1px,_transparent_1px)] bg-[length:18px_18px]" :
      bg === "pattern_grid" ? "bg-[linear-gradient(to_right,rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.08)_1px,transparent_1px)] bg-[size:18px_18px]" :
      bg === "pattern_stripes" ? "bg-[repeating-linear-gradient(45deg,rgba(255,255,255,0.08)_0_10px,transparent_10px_20px)]" :
      "bg-surface";

    const frameCls =
      frame === "rounded_xl" ? "rounded-xl border border-border" :
      frame === "wireframe" ? "bg-transparent border-2 border-dashed" :
      frame === "neon_emerald" ? `bg-surface ring-1 ${accentRing} border-transparent` :
      frame === "neon_violet" ? `bg-surface ring-1 ring-violet-500/60 shadow-[0_0_12px_rgba(139,92,246,0.35)] border-transparent` :
      "border border-border";

    return `${bgCls} ${frameCls}`;
  }

  // Header com cor/acento
  function modalHeaderClassFor(uid: string) {
    const accent = (participants[uid]?.cosmetics?.modalAccent as Cosmetics["modalAccent"]) ?? (uid === user?.uid ? cosmetics.modalAccent : "emerald");
    switch (accent) {
      case "violet":
        return "bg-violet-700 text-white";
      case "cyan":
        return "bg-cyan-700 text-white";
      case "rose":
        return "bg-rose-700 text-white";
      case "amber":
        return "bg-amber-600 text-white";
      case "indigo":
        return "bg-indigo-700 text-white";
      default:
        return "bg-emerald-700 text-white";
    }
  }

  function scrollToMessageById(messageId?: string | null) {
    if (!messageId) return;
    const container = messagesContainerRef.current;
    const el = messageItemRefs.current[messageId];
    if (!container || !el) return;
    try {
      const top = el.offsetTop;
      container.scrollTo({ top: Math.max(0, top - 24), behavior: "auto" });
      // destaque temporário
      el.style.transition = "filter 150ms ease";
      el.style.filter = "brightness(1.15)";
      setTimeout(() => {
        el.style.filter = "";
      }, 1200);
    } catch {}
  }

  // Detecta se o texto é uma URL de imagem (extensões comuns)
  function isImageUrl(t: string) {
    if (!t || typeof t !== "string") return false;
    if (!/^https?:\/\//i.test(t)) return false;
    try {
      const u = new URL(t);
      return /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(u.pathname);
    } catch {
      return false;
    }
  }

  // Texto curto para prévia de resposta, com “...”
  function shortReplyPreview(m: any, limit: number = 60) {
    if (!m) return "";
    const base = (m.text && typeof m.text === "string" && m.text.trim().length > 0)
      ? m.text.trim()
      : (m.kind === "image" ? "Imagem" : m.kind === "video" ? "Vídeo" : m.kind === "audio" ? "Áudio" : "Mensagem");
    const clean = (base || "").replace(/\s+/g, " ").trim();
    return clean.length > limit ? clean.slice(0, Math.max(0, limit - 3)) + "..." : clean;
  }
  function isVideoUrl(t: string) {
    if (!t || typeof t !== "string") return false;
    if (!/^https?:\/\//i.test(t)) return false;
    try {
      const u = new URL(t);
      return /\.(mp4|webm|ogg|mov|m4v)$/i.test(u.pathname);
    } catch {
      return false;
    }
  }
  function isAudioUrl(t: string) {
    if (!t || typeof t !== "string") return false;
    if (!/^https?:\/\//i.test(t)) return false;
    try {
      const u = new URL(t);
      return /\.(mp3|wav|ogg|m4a|flac)$/i.test(u.pathname);
    } catch {
      return false;
    }
  }

  // Abrir perfil somente leitura de um membro do grupo
  async function openUserProfile(uid: string) {
    try {
      if (!db || !uid) return;
      setViewProfileUid(uid);
      setViewProfileOpen(true);
      setViewProfileLoading(true);
      setViewProfileError(null);
      // Usa dados já carregados nos participantes como base
      const base = participants[uid] || {};
      let about: string | null = null;
      let email: string | null = base.email ?? null;
      try {
        const usnap = await getDoc(doc(db!, "users", uid));
        if (usnap.exists()) {
          const u: any = usnap.data();
          setViewProfile({
            displayName: u?.displayName ?? base.displayName ?? null,
            photoURL: u?.photoURL ?? base.photoURL ?? null,
            email: u?.email ?? email ?? null,
            about: u?.about ?? null,
          });
        } else {
          setViewProfile({
            displayName: base.displayName ?? null,
            photoURL: base.photoURL ?? null,
            email: email ?? null,
            about: about,
          });
        }
      } catch (e: any) {
        setViewProfile({
          displayName: base.displayName ?? null,
          photoURL: base.photoURL ?? null,
          email: email ?? null,
          about: about,
        });
      }
    } catch (e: any) {
      setViewProfileError(e?.message || "Falha ao carregar perfil");
    } finally {
      setViewProfileLoading(false);
    }
  }

  const messagesRef = useMemo(() => {
    if (!configured) return null;
    if (!db) return null;
    return collection(db!, "chats", chatId, "messages");
  }, [chatId, configured]);

  useEffect(() => {
    if (!messagesRef) return;
    const q = query(messagesRef, orderBy("createdAt", "asc"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const data = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Message) }));
        setMessages(data);
        setError(null);
      },
      (err) => {
        if (err?.code === "permission-denied") {
          setError(
            "Permissões insuficientes no Firestore para ler mensagens. Ajuste as regras para permitir usuários autenticados neste chat."
          );
        } else {
          setError(`Erro no listener: ${err?.code || "desconhecido"}`);
        }
      }
    );
    return () => unsub();
  }, [messagesRef]);

  // Mantenha sempre a visualização na mensagem mais recente, sem animação
  useEffect(() => {
    const el = messagesContainerRef.current;
    if (!el) return;
    // aguardar a pintura das novas mensagens antes de rolar
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(() => {
        el.scrollTop = el.scrollHeight;
      });
    } else {
      setTimeout(() => {
        el.scrollTop = el.scrollHeight;
      }, 0);
    }
  }, [messages.length]);

  // Carrega perfis dos membros para exibir nomes e definir o título
  useEffect(() => {
    if (!configured || !db || !chatId) return;
    (async () => {
      try {
        const cref = doc(db!, "chats", chatId);
        const csnap = await getDoc(cref);
        const cdata = csnap.exists() ? (csnap.data() as any) : {};
        setChatType(cdata?.type);
        setGroupPhotoURL(cdata?.photoURL || null);
        setGroupOwner(cdata?.owner || null);
        const admins: string[] = Array.isArray(cdata?.admins) ? cdata.admins : (cdata?.owner ? [cdata.owner] : []);
        setGroupAdmins(admins);
        const members: string[] = Array.isArray(cdata?.members) ? cdata.members : [];
        setGroupMembers(members);
        const map: Record<string, Participant> = {};
        for (const uid of members) {
          try {
            const uref = doc(db!, "users", uid);
            const usnap = await getDoc(uref);
            const udata = usnap.exists() ? (usnap.data() as any) : {};
            map[uid] = {
              displayName: udata?.displayName ?? null,
              email: udata?.email ?? null,
              photoURL: udata?.photoURL ?? null,
              cosmetics: (udata?.cosmetics as Cosmetics) ?? undefined,
            };
          } catch {}
        }
        setParticipants(map);
        if ((cdata?.type || "private") === "private") {
          if (user) {
            const otherUid = members.find((u) => u !== user.uid);
            const other = otherUid ? map[otherUid] : undefined;
            setChatTitle(other?.displayName || other?.email || "Chat");
          } else {
            setChatTitle("Chat");
          }
        } else {
          setChatTitle(cdata?.name || "Chat");
        }
      } catch {}
    })();
  }, [configured, db, chatId, user]);

  // Ao abrir a conversa, zerar contador de não lidas para o usuário atual
  useEffect(() => {
    if (!db || !user || !chatId) return;
    (async () => {
      try {
        const cref = doc(db!, "chats", chatId);
        await updateDoc(cref, { ["unreadCounts." + user.uid]: 0 });
      } catch {}
    })();
  }, [db, user, chatId]);

  // Removido: reset contínuo em cada atualização do documento do chat.
  // Mantemos apenas o reset ao abrir a conversa para evitar flicker na sidebar.

  // Busca usuário por email (igual à versão do layout)
  async function getUserByEmail(email: string) {
    if (!db) return null;
    const usersRef = collection(db, "users");
    const q = query(usersRef, where("email", "==", email));
    const snap = await getDocs(q);
    if (snap.empty) return null;
    const d = snap.docs[0];
    return { uid: d.id, ...(d.data() as any) } as {
      uid: string;
      email?: string | null;
      displayName?: string | null;
      photoURL?: string | null;
    };
  }

  async function searchUsersByEmailPrefix(prefix: string) {
    if (!db) return [] as Array<{ uid: string; email?: string | null; displayName?: string | null; photoURL?: string | null }>;
    const usersRef = collection(db, "users");
    const q = query(usersRef, where("email", ">=", prefix), where("email", "<=", prefix + "\uf8ff"), limit(8));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ uid: d.id, ...(d.data() as any) }));
  }

  useEffect(() => {
    const s = addMemberEmail.trim().toLowerCase();
    if (!db || s.length < 2) { setEmailSuggestions([]); return; }
    setEmailSuggesting(true);
    const t = setTimeout(async () => {
      try {
        const res = await searchUsersByEmailPrefix(s);
        const filtered = res.filter((u) => !!u.uid && !groupMembers.includes(u.uid));
        setEmailSuggestions(filtered);
      } catch {
        // silencioso
      } finally {
        setEmailSuggesting(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [addMemberEmail, db, groupMembers]);

  // Pressionar ESC volta para a tela de seleção de conversa
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        try {
          setGroupSettingsOpen(false);
          setProfileOpen(false);
        } catch {}
        router.push("/chat");
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [router]);

  const canManageGroup = !!user && (user.uid === groupOwner || groupAdmins.includes(user.uid));

  function toggleAdmin(uid: string) {
    setGroupAdmins((prev) => {
      const has = prev.includes(uid);
      return has ? prev.filter((x) => x !== uid) : [...prev, uid];
    });
  }

  async function addMemberByEmailFromSettings() {
    if (!db || !user || !addMemberEmail.trim()) return;
    try {
      setGroupSettingsError(null);
      setAddMemberSearching(true);
      const u = await getUserByEmail(addMemberEmail.trim().toLowerCase());
      setAddMemberSearching(false);
      if (!u) {
        setGroupSettingsError("Usuário não encontrado pelo email informado.");
        return;
      }
      if (groupMembers.includes(u.uid)) {
        setGroupSettingsError("Usuário já é membro do grupo.");
        return;
      }
      const nextMembers = [...groupMembers, u.uid];
      setGroupMembers(nextMembers);
      setAddMemberEmail("");
    } catch (e: any) {
      setAddMemberSearching(false);
      setGroupSettingsError(e?.message || "Erro ao buscar usuário");
    }
  }

  async function saveGroupSettings() {
    if (!db || !user) return;
    if (!canManageGroup) {
      setGroupSettingsError("Apenas admins podem alterar configurações do grupo.");
      return;
    }
    try {
      setGroupSettingsSaving(true);
      await updateDoc(doc(db!, "chats", chatId), {
        members: groupMembers,
        admins: groupAdmins.length > 0 ? groupAdmins : (groupOwner ? [groupOwner] : []),
        updatedAt: serverTimestamp(),
      });
      setGroupSettingsOpen(false);
      setGroupSettingsError(null);
    } catch (e: any) {
      setGroupSettingsError(e?.code || "Falha ao salvar configurações");
    } finally {
      setGroupSettingsSaving(false);
    }
  }

  async function openProfileModal() {
    if (!user || !db) return;
    setProfileError(null);
    setProfileInfo(null);
    setProfileLoading(true);
    setProfileOpen(true);
    try {
      const ref = doc(db!, "users", user.uid);
      const snap = await getDoc(ref);
      const data = snap.exists() ? (snap.data() as any) : {};
      // Priorizar valores do banco; não usar fallback do provedor para photoURL
      setDisplayName(data?.displayName || user.displayName || "");
      setPhotoURL(data?.photoURL || "");
      setAbout(data?.about || "");
    } catch (e: any) {
      setProfileError(`Erro ao carregar perfil: ${e?.code || "verifique conexão"}`);
    } finally {
      setProfileLoading(false);
    }
  }

  async function saveProfile() {
    if (!user || !db) return;
    setProfileError(null);
    setProfileInfo(null);
    setProfileLoading(true);
    try {
      const ref = doc(db!, "users", user.uid);
      await setDoc(
        ref,
        {
          uid: user.uid,
          email: user.email || null,
          displayName: displayName.trim() || null,
          photoURL: photoURL.trim() || null,
          about: about.trim() || null,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      setProfileOpen(false);
    } catch (e: any) {
      setProfileError(`Erro ao salvar: ${e?.code || "verifique conexão"}`);
    } finally {
      setProfileLoading(false);
    }
  }

  async function uploadAvatar(file: File) {
    if (!user || !db) return;
    if (!file || !file.type.startsWith("image/")) {
      setProfileError("Selecione uma imagem válida.");
      return;
    }
    setProfileError(null);
    setProfileInfo(null);
    setAvatarUploading(true);
    try {
      const res = await fetch("/api/s3/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: file.name, contentType: file.type, uid: user.uid }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || `Falha ao gerar URL (${res.status})`);
      }
      const { uploadUrl, publicUrl, requiredHeaders } = await res.json();
      const headers: Record<string, string> = { "Content-Type": file.type, ...(requiredHeaders || {}) };
      const put = await fetch(uploadUrl, { method: "PUT", headers, body: file });
      if (!put.ok) throw new Error(`Upload do avatar falhou (${put.status})`);

      // Atualiza o perfil somente com photoURL, mantendo o modal aberto
      const ref = doc(db!, "users", user.uid);
      await setDoc(
        ref,
        {
          uid: user.uid,
          photoURL: publicUrl,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      setPhotoURL(publicUrl);
      setProfileInfo("Avatar atualizado!");
    } catch (e: any) {
      setProfileError(e?.message || "Falha ao enviar avatar");
    } finally {
      setAvatarUploading(false);
    }
  }

  async function uploadImage(file: File) {
    if (!user) {
      setError("Faça login para enviar imagens.");
      return;
    }
    setError(null);
    setUploading(true);
    try {
      const res = await fetch("/api/s3/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: file.name, contentType: file.type, uid: user.uid }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || `Falha ao gerar URL (${res.status})`);
      }
      const { uploadUrl, publicUrl, requiredHeaders } = await res.json();
      const headers: Record<string, string> = {
        "Content-Type": file.type,
        ...(requiredHeaders || {}),
      };
      const put = await fetch(uploadUrl, { method: "PUT", headers, body: file });
      if (!put.ok) throw new Error(`Upload falhou (${put.status})`);
      // opcional: enviar a mensagem com a URL da imagem automaticamente
      setText(publicUrl);
      await sendMessage();
    } catch (e: any) {
      setError(e?.message || "Falha no upload");
    } finally {
      setUploading(false);
    }
  }

  // Seleciona arquivos e cria pré-visualizações
  function addPendingFiles(fs: FileList | File[]) {
    const arr = Array.from(fs);
    const accepted: PendingItem[] = [];
    for (const f of arr) {
      const ct = f.type || "";
      const kind: PendingItem["kind"] = ct.startsWith("image/")
        ? "image"
        : ct.startsWith("video/")
        ? "video"
        : ct.startsWith("audio/")
        ? "audio"
        : "file";
      if (kind === "file") {
        setError("Tipo de arquivo não suportado. Use imagem, vídeo ou áudio.");
        continue;
      }
      let previewUrl: string | null = null;
      try {
        if (kind === "image" || kind === "video" || kind === "audio") previewUrl = URL.createObjectURL(f);
      } catch {}
      accepted.push({ file: f, kind, previewUrl });
    }
    if (accepted.length > 0) {
      setPendingItems((prev) => [...prev, ...accepted]);
      setError(null);
    }
  }

  function removePendingAt(idx: number) {
    setPendingItems((prev) => {
      const next = [...prev];
      const it = next[idx];
      try {
        if (it?.previewUrl) URL.revokeObjectURL(it.previewUrl);
      } catch {}
      next.splice(idx, 1);
      return next;
    });
  }

  function clearPendingAll() {
    setPendingItems((prev) => {
      for (const it of prev) {
        try {
          if (it.previewUrl) URL.revokeObjectURL(it.previewUrl);
        } catch {}
      }
      return [];
    });
  }

  function putWithProgress(url: string, file: File, headers: Record<string, string>, onProgress?: (pct: number) => void, id?: string) {
    return new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      if (id) currentUploadXhr.current[id] = xhr;
      xhr.open("PUT", url);
      Object.entries(headers || {}).forEach(([k, v]) => xhr.setRequestHeader(k, v));
      xhr.upload.onprogress = (evt) => {
        if (evt.lengthComputable && onProgress) {
          const pct = Math.round((evt.loaded / evt.total) * 100);
          onProgress(pct);
        }
      };
      xhr.onerror = () => reject(new Error("Falha no upload"));
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) resolve();
        else reject(new Error(`Upload falhou (${xhr.status})`));
      };
      xhr.send(file);
    });
  }

  // Ações: abrir/fechar menu e long press no mobile
  function openActionMenuFor(messageId: string, x: number, y: number) {
    setActionMenu({ messageId, x, y });
  }
  function closeActionMenu() {
    setActionMenu(null);
  }
  function scheduleLongPress(messageId: string, x: number, y: number) {
    try {
      if (longPressTimerRef.current) window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = window.setTimeout(() => {
        openActionMenuFor(messageId, x, y);
      }, 450);
    } catch {}
  }
  function cancelLongPress() {
    if (longPressTimerRef.current) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }

  // Reações rápidas: 👍 ❤️ 😂 👏
  async function toggleReaction(messageId: string, emoji: string) {
    try {
      if (!db || !user) return;
      const mref = doc(db!, "chats", chatId, "messages", messageId);
      const msg = messages.find((mm) => mm.id === messageId) as any;
      const current = msg?.reactions?.[user.uid] || null;
      if (current === emoji) {
        await updateDoc(mref, { ["reactions." + user.uid]: deleteField() as any });
      } else {
        await updateDoc(mref, { ["reactions." + user.uid]: emoji });
      }
    } catch (e: any) {
      setError(e?.message || "Falha ao reagir");
    }
  }

  // Incrementa não lidas para todos os outros membros desta conversa
  async function bumpUnreadForOthers() {
    try {
      if (!db || !user || !chatId) return;
      const cref = doc(db!, "chats", chatId);
      let members = groupMembers && groupMembers.length ? groupMembers : [];
      if (members.length === 0) {
        try {
          const csnap = await getDoc(cref);
          const cdata = csnap.exists() ? (csnap.data() as any) : {};
          members = Array.isArray(cdata?.members) ? cdata.members : [];
        } catch {}
      }
      const updates: Record<string, any> = {};
      (members || []).filter((uid) => uid && uid !== user.uid).forEach((uid) => {
        updates["unreadCounts." + uid] = increment(1);
      });
      if (Object.keys(updates).length > 0) {
        try { await updateDoc(cref, updates); } catch {}
      }
    } catch {}
  }

  // Gravador de áudio: iniciar
  async function startRecording() {
    try {
      if (typeof window === "undefined" || !(navigator.mediaDevices && (window as any).MediaRecorder)) {
        setError("Seu navegador não suporta gravação de áudio.");
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      let options: MediaRecorderOptions | undefined = undefined;
      const MR: any = (window as any).MediaRecorder;
      if (MR && typeof MR.isTypeSupported === "function") {
        if (MR.isTypeSupported("audio/webm")) options = { mimeType: "audio/webm" } as any;
        else if (MR.isTypeSupported("audio/ogg")) options = { mimeType: "audio/ogg" } as any;
      }
      const rec = new MR(stream, options);
      recordedChunksRef.current = [];
      rec.ondataavailable = (e: BlobEvent) => {
        if (e.data && e.data.size > 0) recordedChunksRef.current.push(e.data);
      };
      rec.onstop = () => {
        try {
          const mime = (rec as any).mimeType || "audio/webm";
          const blob = new Blob(recordedChunksRef.current, { type: mime });
          if (shouldSaveRecordingRef.current) {
            const ext = mime.includes("ogg") ? "ogg" : "webm";
            const file = new File([blob], `audio-${Date.now()}.${ext}`, { type: mime });
            // Enviar automaticamente o áudio, sem preview
            void (async () => {
              try {
                if (!messagesRef || !user) return;
                const placeholderRef = await addDoc(messagesRef, {
                  from: user.uid,
                  text: "",
                  kind: "audio",
                  uploading: true,
                  delivered: false,
                  fileName: file.name,
                  contentType: file.type,
                  createdAt: serverTimestamp(),
                  replyToId: replyTo?.id || null,
                  replyToText: (replyTo as any)?.text || null,
                  replyToKind: (replyTo as any)?.kind || null,
                  replyToFrom: (replyTo as any)?.from || null,
                } as any);

                try {
                  await updateDoc(doc(db!, "chats", chatId), {
                    lastMessage: "Áudio",
                    updatedAt: serverTimestamp(),
                  });
                } catch {}

                // Incrementa não lidas para outros membros
                await bumpUnreadForOthers();

                const res = await fetch("/api/s3/upload", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ fileName: file.name, contentType: file.type, uid: user.uid }),
                });
                if (!res.ok) {
                  const j = await res.json().catch(() => ({}));
                  throw new Error(j?.error || `Falha ao gerar URL (${res.status})`);
                }
                const { uploadUrl, publicUrl, requiredHeaders } = await res.json();

                setUploadProgress((p) => ({ ...p, [placeholderRef.id]: 0 }));
                await putWithProgress(
                  uploadUrl,
                  file,
                  { "Content-Type": file.type, ...(requiredHeaders || {}) },
                  (pct) => setUploadProgress((p) => ({ ...p, [placeholderRef.id]: pct })),
                  placeholderRef.id
                );

                await updateDoc(placeholderRef, { fileUrl: publicUrl, uploading: false, delivered: true });
                setError(null);
              } catch (e: any) {
                setError(e?.message || "Falha ao enviar áudio");
              }
            })();
          }
        } catch {}
        // Encerrar tracks
        if (mediaStreamRef.current) {
          mediaStreamRef.current.getTracks().forEach((t) => t.stop());
          mediaStreamRef.current = null;
        }
        setIsRecording(false);
        shouldSaveRecordingRef.current = true;
      };
      mediaRecorderRef.current = rec as MediaRecorder;
      rec.start();
      setIsRecording(true);
      setError(null);
    } catch (e: any) {
      setError(e?.message || "Falha ao iniciar gravação");
    }
  }

  // Gravador de áudio: parar e salvar
  async function stopRecording(save: boolean = true) {
    try {
      if (!mediaRecorderRef.current) return;
      shouldSaveRecordingRef.current = !!save;
      mediaRecorderRef.current.stop();
    } catch (e: any) {
      setError(e?.message || "Falha ao finalizar gravação");
    }
  }

  async function sendMessage() {
    if (!messagesRef || !user) return;
    // Se há anexos pendentes, envia cada um com placeholder e progresso
    if (pendingItems.length > 0) {
      try {
        for (const it of pendingItems) {
          const kindLabel = it.kind === "image" ? "Imagem" : it.kind === "video" ? "Vídeo" : it.kind === "audio" ? "Áudio" : "Arquivo";
          const placeholderRef = await addDoc(messagesRef, {
            from: user.uid,
            text: "",
            kind: it.kind,
            uploading: true,
            delivered: false,
            fileName: it.file.name,
            contentType: it.file.type,
            createdAt: serverTimestamp(),
            replyToId: replyTo?.id || null,
            replyToText: (replyTo as any)?.text || null,
            replyToKind: (replyTo as any)?.kind || null,
            replyToFrom: (replyTo as any)?.from || null,
          } as any);

          try {
            await updateDoc(doc(db!, "chats", chatId), {
              lastMessage: kindLabel,
              updatedAt: serverTimestamp(),
            });
          } catch {}

          // Incrementa não lidas para outros membros
          await bumpUnreadForOthers();

          const res = await fetch("/api/s3/upload", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ fileName: it.file.name, contentType: it.file.type, uid: user.uid }),
          });
          if (!res.ok) {
            const j = await res.json().catch(() => ({}));
            throw new Error(j?.error || `Falha ao gerar URL (${res.status})`);
          }
          const { uploadUrl, publicUrl, requiredHeaders } = await res.json();

          setUploadProgress((p) => ({ ...p, [placeholderRef.id]: 0 }));
          await putWithProgress(
            uploadUrl,
            it.file,
            { "Content-Type": it.file.type, ...(requiredHeaders || {}) },
            (pct) => setUploadProgress((p) => ({ ...p, [placeholderRef.id]: pct })),
            placeholderRef.id
          );

          const finalUpdate: any = {
            fileUrl: publicUrl,
            uploading: false,
            delivered: true,
          };
          if (it.kind === "image") finalUpdate.imageUrl = publicUrl; // compatibilidade

          await updateDoc(placeholderRef, finalUpdate);
        }

        clearPendingAll();
        setReplyTo(null);
        setError(null);
      } catch (e: any) {
        setError(e?.message || "Falha ao enviar anexos");
      }
      return;
    }

    // Caso contrário, envia texto normalmente
    if (!text.trim()) return;
    try {
      await addDoc(messagesRef, {
        from: user.uid,
        text: text.trim(),
        createdAt: serverTimestamp(),
        replyToId: replyTo?.id || null,
        replyToText: (replyTo as any)?.text || null,
        replyToKind: (replyTo as any)?.kind || null,
        replyToFrom: (replyTo as any)?.from || null,
      });
      try {
        await updateDoc(doc(db!, "chats", chatId), {
          lastMessage: text.trim(),
          updatedAt: serverTimestamp(),
        });
      } catch {}
      // Incrementa não lidas para outros membros
      await bumpUnreadForOthers();
      setText("");
      setReplyTo(null);
      setError(null);
    } catch (e: any) {
      if (e?.code === "permission-denied") {
        setError("Permissões insuficientes no Firestore para escrever mensagens. Atualize as regras.");
      } else {
        setError(`Erro ao enviar: ${e?.code || "verifique conexão"}`);
      }
    }
  }

  if (!configured) {
    return (
      <div className="min-h-screen grid place-items-center p-6">
        <div className="max-w-lg w-full space-y-3">
          <h1 className="text-xl font-semibold">Chat</h1>
          <p className="text-sm text-gray-600">Firebase não configurado. Configure o .env.local e reinicie.</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen grid place-items-center p-6">
        <div className="space-y-4 text-center">
          <p className="text-sm">Você precisa estar logado para ver o chat.</p>
          <a href="/login" className="px-4 py-2 bg-black text-white rounded">Ir para Login</a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <style jsx>{`
        @keyframes gradient-x {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        .animate-gradient-x { animation: gradient-x 6s linear infinite; background-size: 200% 200%; }
        @keyframes flicker { 0%, 100% { opacity: 1; } 50% { opacity: 0.85; } }
      .animate-flicker { animation: flicker 2.2s ease-in-out infinite; }
      @keyframes breath { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.02); } }
      .animate-breath { animation: breath 3s ease-in-out infinite; }
      @keyframes wiggle { 0%, 100% { transform: rotate(-6deg); } 50% { transform: rotate(6deg); } }
      .animate-wiggle { animation: wiggle 1.2s ease-in-out infinite; display: inline-block; }
      @keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-3px); } }
      .animate-float { animation: float 2.8s ease-in-out infinite; display: inline-block; }
      @keyframes beat { 0%, 100% { transform: scale(1); } 25% { transform: scale(1.18); } 40% { transform: scale(0.98); } 60% { transform: scale(1.12); } 75% { transform: scale(1); } }
      .animate-beat { animation: beat 1.6s ease-in-out infinite; display: inline-block; }
      @keyframes twinkle { 0%, 100% { opacity: 1; filter: drop-shadow(0 0 0 rgba(255,255,255,0)); } 50% { opacity: 0.85; filter: drop-shadow(0 0 6px rgba(255,255,255,0.6)); } }
      .animate-twinkle { animation: twinkle 2s ease-in-out infinite; display: inline-block; }
      `}</style>
      <header className="border-b p-3">
        {chatType === "group" ? (
          <button
            className="flex items-center gap-3 cursor-pointer"
            onClick={() => setGroupSettingsOpen(true)}
            title="Abrir configurações do grupo"
          >
            {groupPhotoURL ? (
              <img src={groupPhotoURL} alt={chatTitle || "Avatar"} className="w-8 h-8 rounded-full object-cover border" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-white/10 text-muted grid place-items-center text-sm">
                {(chatTitle || "G").slice(0, 1).toUpperCase()}
              </div>
            )}
            <h1 className="font-medium">{chatTitle}</h1>
          </button>
        ) : (
          <h1 className="font-medium">{chatTitle}</h1>
        )}
      </header>
     <main ref={messagesContainerRef} className="flex-1 p-4 space-y-4 overflow-y-auto">
        {error && (
          <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}
        <ul className="space-y-2">
          {messages
            .filter((m) => (m as any).delivered !== false || m.from === user.uid)
            .map((m, idx, arr) => {
              const p = participants[m.from] || {};
              const label = (p.displayName || p.email || m.from) as string;
              const avatar = (p.photoURL || null) as string | null;
              const isMine = m.from === user.uid;
              const prev = idx > 0 ? arr[idx - 1] : null;
              const showOtherInfo = chatType === "group" && !isMine && (!prev || prev.from !== m.from);
              return (
            <li
              key={m.id}
              className={m.from === user.uid ? "flex justify-end" : "flex justify-start"}
              onDoubleClick={(e) => {
                if (!m.id) return;
                openActionMenuFor(m.id, e.clientX, e.clientY);
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                if (!m.id) return;
                openActionMenuFor(m.id, e.clientX, e.clientY);
              }}
              onTouchStart={(e) => {
                const t = e.touches?.[0];
                if (!t || !m.id) return;
                scheduleLongPress(m.id, t.clientX, t.clientY);
              }}
              onTouchEnd={cancelLongPress}
              onTouchMove={cancelLongPress}
            >
              <div className="flex items-start gap-2 max-w-[85%]" ref={(el) => { if (m.id) messageItemRefs.current[m.id] = el; }}>
                {showOtherInfo ? (
                  avatar ? (
                    <button
                      type="button"
                      title="Ver perfil"
                      onClick={() => { if (chatType === "group") void openUserProfile(m.from); }}
                      className="focus:outline-none"
                    >
                      {avatarElFor(m.from, avatar, "w-8 h-8")}
                    </button>
                  ) : (
                    <button
                      type="button"
                      title="Ver perfil"
                      onClick={() => { if (chatType === "group") void openUserProfile(m.from); }}
                      className="focus:outline-none"
                    >
                      <div className={avatarWrapperClassFor(m.from)}>
                        <div className="w-8 h-8 rounded-full bg-white/10 text-muted grid place-items-center text-[11px]">
                          {(label || "?").slice(0,1).toUpperCase()}
                        </div>
                      </div>
                    </button>
                  )
                ) : (chatType === "group" && !isMine && !showOtherInfo) ? (
                  <div className="w-8 h-8" />
                ) : null}
                <div className="max-w-full">
                {(m as any).replyToId ? (
                  (() => {
                    const target: any = messages.find((mm) => mm.id === (m as any).replyToId) || null;
                    const label = shortReplyPreview(target || { text: (m as any).replyToText, kind: (m as any).replyToKind }, 60);
                    const kind = target?.kind ?? (m as any).replyToKind;
                    const thumb = kind === "image" ? (target?.fileUrl || target?.imageUrl) : null;
                    return (
                      <div
                        className="mb-1 rounded-lg border border-border bg-muted/20 px-2 py-1 text-xs text-muted-foreground max-w-full overflow-hidden cursor-pointer flex items-center gap-2"
                        onClick={() => scrollToMessageById((m as any).replyToId)}
                        title="Ir para mensagem respondida"
                      >
                        {kind === "image" && thumb ? (
                          <img src={thumb} alt="mini" className="w-6 h-6 rounded object-cover border" />
                        ) : kind === "video" ? (
                          <div className="w-6 h-6 rounded border bg-black text-white grid place-items-center">▶</div>
                        ) : kind === "audio" ? (
                          <div className="w-6 h-6 rounded border bg-surface grid place-items-center">🔈</div>
                        ) : null}
                        <span className="truncate">{label}</span>
                      </div>
                    );
                  })()
                ) : null}
                {/* Mensagens com anexos (imagem, vídeo, áudio) */}
                {(m as any).kind === "image" || (m as any).kind === "video" || (m as any).kind === "audio" ? (
                  (m as any).uploading && !(m as any).fileUrl && !(m as any).imageUrl ? (
                    <div className="w-56 h-40 grid place-items-center rounded-lg border border-border bg-muted text-xs text-foreground">
                      {typeof uploadProgress[m.id!] === "number" ? `Enviando… ${uploadProgress[m.id!]}%` : "Enviando…"}
                    </div>
                  ) : (
                    (m as any).kind === "image" ? (
                      <div className={m.from === user.uid ? "inline-block overflow-hidden rounded-lg" : "inline-block overflow-hidden rounded-lg border border-border bg-surface"}>
                        <img
                          src={(m as any).fileUrl || (m as any).imageUrl}
                          alt="Imagem enviada"
                          className="max-w-full max-h-[24rem] object-contain block cursor-pointer"
                          loading="lazy"
                          onClick={() => window.open((m as any).fileUrl || (m as any).imageUrl, "_blank")}
                        />
                      </div>
                    ) : (m as any).kind === "video" ? (
                      <div className={m.from === user.uid ? "inline-block overflow-hidden rounded-lg" : "inline-block overflow-hidden rounded-lg border border-border bg-surface"}>
                        <video
                          src={(m as any).fileUrl}
                          controls
                          className="max-w-full max-h-[24rem] bg-black block"
                        />
                      </div>
                    ) : (
                      <div className="inline-flex items-center rounded-lg px-3 py-2 bg-surface border border-border">
                        <audio src={(m as any).fileUrl} controls className="w-64" />
                      </div>
                    )
                  )
                ) : isImageUrl(m.text) ? (
                  <div className={m.from === user.uid ? "inline-block overflow-hidden rounded-lg" : "inline-block overflow-hidden rounded-lg border border-border bg-surface"}>
                    <img
                      src={m.text}
                      alt="Imagem enviada"
                      className="max-w-full max-h-[24rem] object-contain block cursor-pointer"
                      loading="lazy"
                      onClick={() => window.open(m.text, "_blank")}
                    />
                  </div>
                ) : isVideoUrl(m.text) ? (
                  <div className={m.from === user.uid ? "inline-block overflow-hidden rounded-lg" : "inline-block overflow-hidden rounded-lg border border-border bg-surface"}>
                    <video src={m.text} controls className="max-w-full max-h-[24rem] bg-black block" />
                  </div>
                ) : isAudioUrl(m.text) ? (
                  <div className="inline-flex items-center rounded-lg px-3 py-2 bg-surface border border-border">
                    <audio src={m.text} controls className="w-64" />
                  </div>
                ) : (
                  <div className={bubbleClassesFor(m.from, isMine)}>
                    {showOtherInfo ? (
                      <button
                        type="button"
                        title="Ver perfil"
                        onClick={() => { if (chatType === "group") void openUserProfile(m.from); }}
                      className={`block text-left text-xs font-semibold mb-1 hover:underline truncate ${nameColorClassFor(m.from)}`}
                       >
                         {label}{badgeElFor(m.from)}
                       </button>
                    ) : null}
                    <div className="whitespace-pre-wrap break-words">{m.text}</div>
                  </div>
                )}
                {(() => {
                  const r = (m as any).reactions;
                  if (!r) return null as any;
                  const counts: Record<string, number> = {};
                  Object.values(r).forEach((em: any) => { counts[em] = (counts[em] || 0) + 1; });
                  const entries = Object.entries(counts);
                  if (!entries.length) return null as any;
                  return (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {entries.map(([em, cnt]) => (
                        <span key={em} className="inline-flex items-center gap-1 rounded-full bg-surface border border-border px-2 py-0.5 text-xs">
                          {em} {cnt}
                        </span>
                      ))}
                    </div>
                  );
                })()}
                </div>
                {/* Nunca mostrar avatar/nome para suas próprias mensagens */}
              </div>
            </li>
          );})}
        </ul>
     </main>
      <footer className="p-3 border-t flex flex-col gap-2 overflow-x-hidden">
        {replyTo && (
          <div className="flex items-start justify-between rounded border border-border bg-muted/20 px-3 py-2">
            <button
              className="flex items-center gap-2 min-w-0 text-left"
              title="Ir para mensagem respondida"
              onClick={() => scrollToMessageById((replyTo as any)?.id)}
            >
              {(() => {
                const kind = (replyTo as any)?.kind;
                const thumb = kind === "image" ? ((replyTo as any)?.fileUrl || (replyTo as any)?.imageUrl) : null;
                return (
                  <>
                    {kind === "image" && thumb ? (
                      <img src={thumb} alt="mini" className="w-6 h-6 rounded object-cover border" />
                    ) : kind === "video" ? (
                      <div className="w-6 h-6 rounded border bg-black text-white grid place-items-center">▶</div>
                    ) : kind === "audio" ? (
                      <div className="w-6 h-6 rounded border bg-surface grid place-items-center">🔈</div>
                    ) : null}
                    <div className="min-w-0">
                      <div className="text-xs text-muted-foreground">Respondendo</div>
                      <div className="text-sm w-full overflow-hidden whitespace-nowrap text-ellipsis">
                        {shortReplyPreview(replyTo, 60)}
                      </div>
                    </div>
                  </>
                );
              })()}
            </button>
            <button onClick={() => setReplyTo(null)} className="ml-3 text-sm text-muted-foreground hover:text-foreground">✕</button>
          </div>
        )}
        {pendingItems.length > 0 && (
          <div className="flex flex-wrap gap-3">
            {pendingItems.map((it, idx) => (
              <div key={idx} className="flex items-center gap-2">
                {it.kind === "image" && it.previewUrl ? (
                  <img src={it.previewUrl} alt="Pré-visualização" className="w-20 h-20 rounded object-cover border" />
                ) : it.kind === "video" && it.previewUrl ? (
                  <video src={it.previewUrl} className="w-28 h-20 rounded border" />
                ) : it.kind === "audio" ? (
                  it.previewUrl ? (
                    <audio src={it.previewUrl} controls className="h-10" />
                  ) : (
                    <div className="px-3 py-2 border rounded text-sm">Áudio selecionado</div>
                  )
                ) : null}
                <button onClick={() => removePendingAt(idx)} className="px-2 py-1 rounded border text-red-600">Cancelar</button>
              </div>
            ))}
          </div>
        )}
        <div className="flex gap-2 items-center">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,video/*,audio/*"
            className="hidden"
            onChange={(e) => {
              const files = e.target.files;
              if (files && files.length) addPendingFiles(files);
              if (fileInputRef.current) fileInputRef.current.value = "";
            }}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-10 h-10 grid place-items-center rounded-full border"
            disabled={uploading}
            title="Anexar arquivo"
          >
            {uploading ? "⏳" : "📎"}
          </button>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void sendMessage(); } }}
            placeholder="Mensagem"
            className={
              `flex-1 px-4 py-2 ` + (
                cosmetics.bubbleStyle === "glass" ? "rounded-full backdrop-blur bg-white/5 border border-white/10" :
                cosmetics.bubbleStyle === "glow" ? "rounded-full bg-surface border border-border shadow-[0_0_8px_rgba(16,185,129,0.35)] ring-1 ring-emerald-500/40" :
                cosmetics.bubbleStyle === "rounded_md" ? "rounded-md bg-surface border border-border" :
                cosmetics.bubbleStyle === "rounded_xl" ? "rounded-xl bg-surface border border-border" :
                cosmetics.bubbleStyle === "wireframe" ? "rounded-md bg-transparent border-2 border-dashed" :
                "rounded-full border"
              )
            }
          />
          {text.trim().length > 0 ? (
            <button
              onClick={() => void sendMessage()}
              className="w-10 h-10 grid place-items-center rounded-full bg-primary text-white"
              title="Enviar mensagem"
            >
              ➤
            </button>
          ) : (
            <button
              onClick={() => (isRecording ? stopRecording(true) : startRecording())}
              className={`w-10 h-10 grid place-items-center rounded-full border ${isRecording ? "border-red-500 text-red-600" : ""}`}
              title={isRecording ? "Parar gravação" : "Gravar áudio"}
            >
              {isRecording ? "⏹️" : "🎙️"}
            </button>
          )}
        </div>
      </footer>

      {actionMenu && (
        <div className="fixed inset-0 z-50" onClick={closeActionMenu}>
          <div
            className="absolute z-50 rounded border border-border bg-surface shadow px-3 py-2 flex flex-col gap-2"
            style={{ left: actionMenu.x, top: actionMenu.y }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="px-3 py-1 rounded bg-primary text-white"
              onClick={() => {
                const m = messages.find((mm) => mm.id === actionMenu.messageId);
                setReplyTo(m || null);
                closeActionMenu();
              }}
            >
              Responder
            </button>
            <div className="flex gap-1 items-center">
              {['👍','❤️','😂','👏'].map((emoji) => (
                <button
                  key={emoji}
                  className="px-2 py-1 rounded border"
                  onClick={() => { void toggleReaction(actionMenu.messageId, emoji); closeActionMenu(); }}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {profileOpen && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-4">
          <div className="bg-white rounded shadow w-full max-w-lg">
            <div className="border-b p-3 flex items-center justify-between">
              <div className="font-medium">Editar perfil</div>
              <button onClick={() => setProfileOpen(false)} className="text-gray-500">✕</button>
            </div>
            <div className="p-4 space-y-3">
              {profileError && (
                <div className="rounded border border-red-300 bg-red-50 p-2 text-sm text-red-700">
                  {profileError}
                </div>
              )}
              <div className="space-y-2">
                <label className="text-sm">Nome de exibição</label>
                <input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Seu nome"
                  className="w-full border rounded px-3 py-2"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm">URL do avatar</label>
                <input
                  value={photoURL}
                  onChange={(e) => setPhotoURL(e.target.value)}
                  placeholder="https://..."
                  className="w-full border rounded px-3 py-2"
                />
                <div className="flex items-center gap-2">
                  <input
                    ref={avatarInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void uploadAvatar(f);
                      if (avatarInputRef.current) avatarInputRef.current.value = "";
                    }}
                  />
                  <button
                    onClick={() => avatarInputRef.current?.click()}
                    className="px-3 py-2 rounded border"
                    disabled={avatarUploading}
                  >
                    {avatarUploading ? "Enviando..." : "📷 Enviar avatar"}
                  </button>
                  {photoURL && isImageUrl(photoURL) && (
                    <img
                      src={photoURL}
                      alt="Avatar"
                      className="w-10 h-10 rounded-full object-cover border"
                    />
                  )}
                </div>
                {profileInfo && (
                  <div className="rounded border border-green-300 bg-green-50 p-2 text-sm text-green-800">
                    {profileInfo}
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <label className="text-sm">Sobre você</label>
                <textarea
                  value={about}
                  onChange={(e) => setAbout(e.target.value)}
                  placeholder="Bio, interesses, etc."
                  className="w-full border rounded px-3 py-2"
                  rows={3}
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button onClick={() => setProfileOpen(false)} className="px-3 py-2 rounded border">Cancelar</button>
                <button
                  onClick={() => void saveProfile()}
                  className="px-3 py-2 rounded bg-blue-600 text-white"
                  disabled={profileLoading}
                >
                  {profileLoading ? "Salvando..." : "Salvar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {viewProfileOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className={`rounded shadow w-full max-w-md ${modalContainerClassFor(viewProfileUid || "")}`}>
            <div className={`border-b border-border p-3 flex items-center justify-between rounded-t ${modalHeaderClassFor(viewProfileUid || "")}`}>
              <div className="font-medium">Perfil do membro</div>
              <button onClick={() => { setViewProfileOpen(false); setViewProfileUid(null); setViewProfile(null); }} className="text-white/80 hover:text-white">✕</button>
            </div>
            <div className="p-4 space-y-3">
              {viewProfileLoading ? (
                <div className="text-sm text-muted">Carregando perfil…</div>
              ) : viewProfileError ? (
                <div className="rounded border border-red-300 bg-red-50 p-2 text-sm text-red-700">{viewProfileError}</div>
              ) : viewProfile ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    {viewProfile.photoURL ? (
                      avatarElFor(viewProfileUid || "", viewProfile.photoURL, "w-14 h-14")
                    ) : (
                      <div className={avatarWrapperClassFor(viewProfileUid || "")}>
                        <div className="w-14 h-14 rounded-full bg-white/10 grid place-items-center text-base text-muted">
                          {(viewProfile.displayName || viewProfile.email || viewProfileUid || "?").slice(0,1).toUpperCase()}
                        </div>
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className={`text-base font-medium truncate ${nameColorClassFor(viewProfileUid || "")}`}>
                        {viewProfile.displayName || viewProfile.email || viewProfileUid}
                        {badgeElFor(viewProfileUid || "")}
                      </div>
                      {viewProfile.email && (
                        <div className="text-xs text-muted truncate">{viewProfile.email}</div>
                      )}
                    </div>
                  </div>
                  {viewProfile.about ? (
                    <div>
                      <div className="text-sm text-muted">Bio</div>
                      <div className={bubbleClassesFor(viewProfileUid || "", false)}>
                        <div className="text-sm whitespace-pre-wrap break-words">{viewProfile.about}</div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm text-muted">Sem bio informada.</div>
                  )}
                </div>
              ) : (
                <div className="text-sm text-muted">Perfil não encontrado.</div>
              )}
              <div className="flex justify-end pt-2">
                <button onClick={() => { setViewProfileOpen(false); setViewProfileUid(null); setViewProfile(null); }} className="px-3 py-2 rounded bg-emerald-700 text-white hover:bg-emerald-600">Fechar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {groupSettingsOpen && chatType === "group" && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-surface rounded border border-border shadow w-full max-w-xl">
            <div className="border-b border-border p-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                {groupPhotoURL ? (
                  <img src={groupPhotoURL} alt={chatTitle || "Avatar"} className="w-8 h-8 rounded-full object-cover border border-border" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-white/10 text-muted grid place-items-center text-sm">
                    {(chatTitle || "G").slice(0, 1).toUpperCase()}
                  </div>
                )}
                <div className="font-medium">Configurações do grupo</div>
              </div>
              <button onClick={() => setGroupSettingsOpen(false)} className="text-muted hover:text-foreground">✕</button>
            </div>
            <div className="p-4 space-y-4">
              {groupSettingsError && (
                <div className="rounded border border-red-500/50 bg-red-500/10 p-2 text-sm text-red-300">
                  {groupSettingsError}
                </div>
              )}
              <div>
                <div className="text-sm font-medium mb-2">Membros</div>
                <ul className="space-y-2 max-h-60 overflow-y-auto">
                  {groupMembers.map((uid) => {
                    const p = participants[uid] || {};
                    const label = p.displayName || p.email || uid;
                    const avatar = p.photoURL || null;
                    const isAdmin = groupAdmins.includes(uid);
                    return (
                      <li key={uid} className="flex items-center gap-2">
                        {avatar ? (
                          <button
                            type="button"
                            title="Ver perfil"
                            onClick={() => void openUserProfile(uid)}
                            className="focus:outline-none"
                          >
                            {avatarElFor(uid, avatar, "w-8 h-8")}
                          </button>
                        ) : (
                          <button
                            type="button"
                            title="Ver perfil"
                            onClick={() => void openUserProfile(uid)}
                            className="focus:outline-none"
                          >
                            <div className={avatarWrapperClassFor(uid)}>
                              <div className="w-8 h-8 rounded-full bg-white/10 text-muted grid place-items-center text-xs">
                                {(label || "?").slice(0, 1).toUpperCase()}
                              </div>
                            </div>
                          </button>
                        )}
                        <button
                          type="button"
                          title="Ver perfil"
                          onClick={() => void openUserProfile(uid)}
                          className="text-sm flex-1 truncate text-left hover:underline"
                        >
                          {label}
                        </button>
                        <label className="flex items-center gap-1 text-xs">
                          <input type="checkbox" checked={isAdmin} onChange={() => toggleAdmin(uid)} disabled={!canManageGroup} />
                          <span>Admin</span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </div>
              <div className="space-y-2">
                <div className="text-sm font-medium">Adicionar membro por email</div>
                <div className="flex gap-2">
                  <input
                    value={addMemberEmail}
                    onChange={(e) => setAddMemberEmail(e.target.value)}
                    placeholder="usuario@exemplo.com"
                    className="flex-1 rounded px-3 py-2 bg-background border border-border text-foreground placeholder:text-muted"
                  />
                  <button
                    onClick={() => void addMemberByEmailFromSettings()}
                    className="px-3 py-2 bg-primary text-white rounded hover:bg-primary/90"
                    disabled={!canManageGroup || addMemberSearching || !addMemberEmail.trim()}
                  >
                    {addMemberSearching ? "Buscando..." : "Adicionar"}
                  </button>
                </div>
                {/* Sugestões de email */}
                {(emailSuggesting || emailSuggestions.length > 0) && (
                  <div className="mt-2 rounded border border-border bg-surface">
                    {emailSuggesting ? (
                      <div className="px-3 py-2 text-sm text-muted">Buscando usuários…</div>
                    ) : emailSuggestions.length === 0 ? (
                      <div className="px-3 py-2 text-sm text-muted">Nenhum usuário encontrado</div>
                    ) : (
                      <ul className="divide-y divide-border">
                        {emailSuggestions.map((u) => {
                          const label = u.displayName || u.email || u.uid;
                          const avatar = u.photoURL || null;
                          return (
                            <li key={u.uid} className="flex items-center gap-2 px-3 py-2 hover:bg-white/5 cursor-pointer"
                                onClick={() => { setGroupMembers((prev) => prev.includes(u.uid) ? prev : [...prev, u.uid]); setAddMemberEmail(""); setEmailSuggestions([]); }}>
                              {avatar ? (
                                <img src={avatar} alt={label || "Avatar"} className="w-8 h-8 rounded-full object-cover border border-border" />
                              ) : (
                                <div className="w-8 h-8 rounded-full bg-white/10 text-muted grid place-items-center text-xs">
                                  {(label || "?").slice(0, 1).toUpperCase()}
                                </div>
                              )}
                              <div className="min-w-0">
                                <div className="text-sm truncate">{label}</div>
                                {u.email && <div className="text-xs text-muted truncate">{u.email}</div>}
                              </div>
                              <div className="ml-auto text-xs text-muted">Adicionar</div>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                )}
              </div>
              {!canManageGroup && (
                <div className="text-xs text-muted">Somente admins podem alterar estas configurações.</div>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <button onClick={() => setGroupSettingsOpen(false)} className="px-3 py-2 rounded border border-border hover:bg-white/5">Cancelar</button>
                <button
                  onClick={() => void saveGroupSettings()}
                  className="px-3 py-2 bg-primary text-white rounded hover:bg-primary/90"
                  disabled={!canManageGroup || groupSettingsSaving}
                >
                  {groupSettingsSaving ? "Salvando..." : "Salvar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Modal de configurações do grupo
// Renderiza fora do return principal para manter organização
// Inserimos um bloco JSX condicional abaixo do componente principal