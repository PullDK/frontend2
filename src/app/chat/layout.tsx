"use client";
import Link from "next/link";
import { Settings, X, User, Store, SlidersHorizontal, LogOut, Camera } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { db } from "@/lib/firebase";
import {
  collection,
  onSnapshot,
  query,
  where,
  orderBy,
  getDocs,
  getDoc,
  addDoc,
  doc,
  setDoc,
  updateDoc,
  serverTimestamp,
  documentId,
} from "firebase/firestore";

type Chat = {
  id: string;
  members: string[];
  lastMessage?: string;
  updatedAt?: any;
  type?: "private" | "group";
};

export default function ChatLayout({ children }: { children: React.ReactNode }) {
  const { user, configured, logout } = useAuth();
  const router = useRouter();
  const [chats, setChats] = useState<Chat[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [useFallback, setUseFallback] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [emailInput, setEmailInput] = useState("");
  const [target, setTarget] = useState<{ uid: string; email?: string | null; displayName?: string | null; photoURL?: string | null } | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [searching, setSearching] = useState(false);
  const [profiles, setProfiles] = useState<Record<string, { displayName?: string | null; photoURL?: string | null; email?: string | null }>>({});
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();
  const activeChatId = useMemo(() => {
    if (!pathname) return null as string | null;
    const parts = pathname.split("/").filter(Boolean);
    return parts[0] === "chat" && parts[1] ? parts[1] : null;
  }, [pathname]);

  // Amigos (sistema de contatos)
  const [friends, setFriends] = useState<string[]>([]);
  const [friendProfiles, setFriendProfiles] = useState<Record<string, { displayName?: string | null; email?: string | null; photoURL?: string | null }>>({});
  const [friendEmail, setFriendEmail] = useState("");
  const [friendAdding, setFriendAdding] = useState(false);
  const [friendError, setFriendError] = useState<string | null>(null);

  // Modal de criação de grupo
  const [groupOpen, setGroupOpen] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [groupDescription, setGroupDescription] = useState("");
  const [groupPhotoURL, setGroupPhotoURL] = useState("");
  const [groupCreating, setGroupCreating] = useState(false);
  const [groupError, setGroupError] = useState<string | null>(null);
  const groupAvatarInputRef = useRef<HTMLInputElement | null>(null);
  const [memberEmail, setMemberEmail] = useState("");
  const [memberSearching, setMemberSearching] = useState(false);
  const [selectedMemberUids, setSelectedMemberUids] = useState<string[]>([]);

  // Modal de perfil (copiado do chat page)
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileInfo, setProfileInfo] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [photoURL, setPhotoURL] = useState("");
  const [about, setAbout] = useState("");
  const [avatarUploading, setAvatarUploading] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);

  const chatsRef = useMemo(() => {
    if (!configured) return null;
    return collection(db!, "chats");
  }, [configured]);

  // Exigir login antes de acessar /chat
  useEffect(() => {
    if (!configured) return; // sem config, mostramos conteúdo informativo
    if (!user) {
      router.replace("/login");
    }
  }, [configured, user, router]);

  useEffect(() => {
    if (!chatsRef || !user) return;
    const q = useFallback
      ? query(
          chatsRef,
          where("members", "array-contains", user.uid)
        )
      : query(
          chatsRef,
          where("members", "array-contains", user.uid),
          orderBy("updatedAt", "desc"),
          orderBy(documentId(), "desc")
        );

    const unsub = onSnapshot(
      q,
      { includeMetadataChanges: true },
      (snap) => {
        // Ignora snapshots com writes pendentes (apenas cliente enviando),
        // para que a ordenação mude apenas após confirmação do servidor.
        if (snap.metadata.hasPendingWrites) return;
        const data = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Chat, "id">) }));
        setChats(data);
        setError(null);
      },
      (err) => {
        if (err?.code === "permission-denied") {
          setError("Permissões insuficientes para carregar conversas. Ajuste suas regras do Firestore.");
        } else if (err?.code === "failed-precondition") {
          setError(
            "Índice necessário para consultar por 'members' ordenando por 'updatedAt'. Ativando fallback sem ordenação. Crie o índice no Console do Firebase para restaurar a ordenação."
          );
          setUseFallback(true);
        } else {
          setError(`Erro ao carregar: ${err?.code || "desconhecido"}`);
        }
      }
    );
    return () => unsub();
  }, [chatsRef, user, useFallback]);

  // Assinar lista de amigos do usuário
  useEffect(() => {
    if (!user || !db) return;
    const ref = collection(db!, "users", user.uid, "friends");
    const unsub = onSnapshot(
      ref,
      (snap) => {
        const list = snap.docs.map((d) => d.id);
        setFriends(list);
      },
      () => {}
    );
    return () => unsub();
  }, [user, db]);

  // Buscar perfis dos amigos quando necessário
  useEffect(() => {
    if (!db) return;
    const missing = friends.filter((uid) => !friendProfiles[uid]);
    if (missing.length === 0) return;
    (async () => {
      const updates: Record<string, { displayName?: string | null; email?: string | null; photoURL?: string | null }> = {};
      for (const uid of missing) {
        try {
          const usnap = await getDoc(doc(db!, "users", uid));
          if (usnap.exists()) {
            const u: any = usnap.data();
            updates[uid] = {
              displayName: u?.displayName ?? null,
              email: u?.email ?? null,
              photoURL: u?.photoURL ?? null,
            };
          } else {
            updates[uid] = {};
          }
        } catch {
          updates[uid] = {};
        }
      }
      setFriendProfiles((prev) => ({ ...prev, ...updates }));
    })();
  }, [friends, db, friendProfiles]);

  // Helpers para modal de perfil
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

  async function openProfileModal() {
    if (!user || !db) return;
    setProfileError(null);
    setProfileInfo(null);
    setProfileLoading(true);
    setProfileOpen(true);
    try {
      const ref = doc(db, "users", user.uid);
      const snap = await getDoc(ref);
      const data = snap.exists() ? (snap.data() as any) : {};
      // Priorizar sempre os valores do banco. Não usar fallback do provedor para photoURL,
      // para evitar que o avatar pareça "mudar" sem edição explícita.
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
      const ref = doc(db, "users", user.uid);
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

      const ref = doc(db, "users", user.uid);
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

  // Buscar perfis dos outros membros de cada conversa
  useEffect(() => {
    if (!user || !db) return;
    const uids = new Set<string>();
    chats.forEach((c) => {
      (c.members || []).forEach((m) => {
        if (m && m !== user.uid) uids.add(m);
      });
    });
    const missing = Array.from(uids).filter((uid) => !profiles[uid]);
    if (missing.length === 0) return;
    (async () => {
      const updates: Record<string, { displayName?: string | null; photoURL?: string | null; email?: string | null }> = {};
      for (const uid of missing) {
        try {
          const snap = await getDoc(doc(db, "users", uid));
          if (snap.exists()) {
            const d: any = snap.data();
            updates[uid] = {
              displayName: d?.displayName || null,
              photoURL: d?.photoURL || null,
              email: d?.email || null,
            };
          } else {
            updates[uid] = {};
          }
        } catch {
          updates[uid] = {};
        }
      }
      setProfiles((prev) => ({ ...prev, ...updates }));
    })();
  }, [chats, user, db, profiles]);

  const filtered = chats.filter((c) => {
    if (!search.trim()) return true;
    const idMatch = c.id.toLowerCase().includes(search.toLowerCase());
    const lastMatch = (c.lastMessage || "").toLowerCase().includes(search.toLowerCase());
    return idMatch || lastMatch;
  });

  // Ordena no cliente apenas em fallback; caso contrário, preserva ordem do Firestore
  const displayed = useMemo(() => {
    if (!useFallback) return filtered;
    const getTs = (x: any) => {
      if (!x) return 0;
      if (typeof x?.toMillis === "function") return x.toMillis();
      if (x instanceof Date) return x.getTime();
      if (typeof x === "number") return x;
      const t = new Date(x).getTime();
      return isNaN(t) ? 0 : t;
    };
    return [...filtered].sort((a, b) => {
      const ta = getTs(a.updatedAt);
      const tb = getTs(b.updatedAt);
      const diff = tb - ta; // desc
      if (diff !== 0) return diff;
      // Desempate estável: id desc para não "trocar de lugar" em empates
      return (b.id || "").localeCompare(a.id || "");
    });
  }, [filtered, useFallback]);

  async function findUserByEmail() {
    setCreateError(null);
    setTarget(null);
    const email = emailInput.trim().toLowerCase();
    if (!email) {
      setCreateError("Informe um email válido.");
      return;
    }
    if (!user) {
      setCreateError("Você precisa estar logado.");
      return;
    }
    if (user.email && user.email.toLowerCase() === email) {
      setCreateError("Você não pode iniciar conversa consigo mesmo.");
      return;
    }
    try {
      setSearching(true);
      const u = await getUserByEmail(email);
      setSearching(false);
      if (!u) {
        setCreateError("Usuário não encontrado pelo email informado.");
        return;
      }
      setTarget(u);
    } catch (e: any) {
      setSearching(false);
      setCreateError(`Erro na busca: ${e?.code || "verifique conexão"}`);
    }
  }

  async function createOrOpenChat() {
    setCreateError(null);
    if (!user || !target) return;
    if (user.uid === target.uid) {
      setCreateError("Você não pode iniciar conversa consigo mesmo.");
      return;
    }
    try {
      setCreating(true);
      const chatsRefLocal = collection(db!, "chats");
      // Busca conversas existentes do usuário e filtra no cliente
      const q = query(chatsRefLocal, where("members", "array-contains", user.uid));
      const snap = await getDocs(q);
      const existing = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as any) }))
        .find((c) => c.type === "private" && Array.isArray(c.members) && c.members.includes(target.uid));
      if (existing) {
        router.push(`/chat/${existing.id}`);
        setCreating(false);
        setNewOpen(false);
        return;
      }
      const newChat = await addDoc(chatsRefLocal, {
        type: "private",
        members: [user.uid, target.uid],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        lastMessage: "Conversa criada",
        unreadCounts: { [user.uid]: 0, [target.uid]: 0 },
      });
      // Atualiza metadados (se necessário) e navega
      await updateDoc(doc(db!, "chats", newChat.id), {
        updatedAt: serverTimestamp(),
      });
      router.push(`/chat/${newChat.id}`);
      setCreating(false);
      setNewOpen(false);
    } catch (e: any) {
      setCreating(false);
      if (e?.code === "permission-denied") {
        setCreateError("Permissões insuficientes para criar conversa. Ajuste as regras do Firestore.");
      } else if (e?.code === "failed-precondition") {
        setCreateError("Crie os índices do Firestore necessários para consultas em 'chats'.");
      } else {
        setCreateError(`Erro ao criar: ${e?.code || "verifique conexão"}`);
      }
    }
  }

  // Adicionar amigo por email (persistir em users/{uid}/friends/{friendUid})
  async function addFriendByEmail() {
    if (!user || !db) return;
    setFriendError(null);
    const email = friendEmail.trim().toLowerCase();
    if (!email) {
      setFriendError("Informe um email válido.");
      return;
    }
    if (user.email && user.email.toLowerCase() === email) {
      setFriendError("Você não pode adicionar a si mesmo.");
      return;
    }
    try {
      setFriendAdding(true);
      const u = await getUserByEmail(email);
      if (!u) {
        setFriendError("Usuário não encontrado pelo email informado.");
        setFriendAdding(false);
        return;
      }
      await setDoc(
        doc(db, "users", user.uid, "friends", u.uid),
        { createdAt: serverTimestamp() },
        { merge: true }
      );
      setFriendEmail("");
    } catch (e: any) {
      if (e?.code === "permission-denied") setFriendError("Permissões insuficientes para gerenciar amigos.");
      else setFriendError(e?.code || "Falha ao adicionar");
    } finally {
      setFriendAdding(false);
    }
  }

  // Upload da foto do grupo (apenas atualiza estado; salva no chat ao criar)
  async function uploadGroupPhoto(file: File) {
    if (!user || !db) return;
    if (!file || !file.type.startsWith("image/")) {
      setGroupError("Selecione uma imagem válida.");
      return;
    }
    setGroupError(null);
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
      if (!put.ok) throw new Error(`Upload da foto do grupo falhou (${put.status})`);
      setGroupPhotoURL(publicUrl);
    } catch (e: any) {
      setGroupError(e?.message || "Falha ao enviar foto do grupo");
    }
  }

  function toggleMember(uid: string) {
    setSelectedMemberUids((prev) => {
      const has = prev.includes(uid);
      if (has) return prev.filter((x) => x !== uid);
      return [...prev, uid];
    });
  }

  async function addMemberByEmail() {
    if (!user || !db) return;
    setGroupError(null);
    const email = memberEmail.trim().toLowerCase();
    if (!email) {
      setGroupError("Informe um email válido.");
      return;
    }
    if (user.email && user.email.toLowerCase() === email) {
      setGroupError("Você já fará parte do grupo.");
      return;
    }
    try {
      setMemberSearching(true);
      const u = await getUserByEmail(email);
      setMemberSearching(false);
      if (!u) {
        setGroupError("Usuário não encontrado pelo email informado.");
        return;
      }
      setSelectedMemberUids((prev) => (prev.includes(u.uid) ? prev : [...prev, u.uid]));
      setMemberEmail("");
    } catch (e: any) {
      setMemberSearching(false);
      setGroupError(`Erro na busca: ${e?.code || "verifique conexão"}`);
    }
  }

  async function createGroup() {
    if (!user || !db) return;
    setGroupError(null);
    if (!groupName.trim()) {
      setGroupError("Informe um nome para o grupo.");
      return;
    }
    if (selectedMemberUids.length === 0) {
      setGroupError("Selecione pelo menos um membro.");
      return;
    }
    try {
      setGroupCreating(true);
      const chatsRefLocal = collection(db, "chats");
      const initialCounts: Record<string, number> = {};
      [user.uid, ...selectedMemberUids].forEach((uid) => { initialCounts[uid] = 0; });
      const newChat = await addDoc(chatsRefLocal, {
        type: "group",
        name: groupName.trim(),
        description: groupDescription.trim() || null,
        photoURL: groupPhotoURL.trim() || null,
        owner: user.uid,
        admins: [user.uid],
        members: [user.uid, ...selectedMemberUids],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        lastMessage: "Grupo criado",
        unreadCounts: initialCounts,
      });
      await updateDoc(doc(db, "chats", newChat.id), { updatedAt: serverTimestamp() });
      router.push(`/chat/${newChat.id}`);
      setGroupCreating(false);
      setGroupOpen(false);
    } catch (e: any) {
      setGroupCreating(false);
      if (e?.code === "permission-denied") setGroupError("Permissões insuficientes para criar grupo. Ajuste as regras do Firestore.");
      else if (e?.code === "failed-precondition") setGroupError("Crie os índices do Firestore necessários para consultas em 'chats'.");
      else setGroupError(`Erro ao criar: ${e?.code || "verifique conexão"}`);
    }
  }

  return (
    <div
      className="min-h-[100dvh] w-full max-w-full grid grid-cols-1 md:grid-cols-[360px_1fr] bg-background overflow-x-hidden"
      style={{ touchAction: "pan-y" }}
    >
      {/* Sidebar */}
      <aside className={`${activeChatId ? "hidden md:flex" : "flex"} border-r border-border bg-surface flex-col h-[100dvh] overflow-y-auto`}>
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between">
            <div className="font-semibold">DKChat</div>
            <div className="relative">
              <button
                onClick={() => setMenuOpen((v) => !v)}
                aria-label="Menu"
                className="w-9 h-9 rounded grid place-items-center hover:bg-white/5"
                title="Menu"
              >
                <Settings className="w-5 h-5" />
              </button>
              {menuOpen && (
                <div className="absolute right-0 mt-2 w-56 rounded border border-border bg-surface shadow">
                  <button
                    onClick={() => { setMenuOpen(false); void openProfileModal(); }}
                    className="w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-white/5"
                  >
                    <User className="w-4 h-4" />
                    <span>Perfil</span>
                  </button>
                  <button
                    onClick={() => { setMenuOpen(false); router.push("/store"); }}
                    className="w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-white/5"
                  >
                    <Store className="w-4 h-4" />
                    <span>Loja</span>
                  </button>
                  <button
                    onClick={() => { setMenuOpen(false); router.push("/settings"); }}
                    className="w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-white/5"
                  >
                    <SlidersHorizontal className="w-4 h-4" />
                    <span>Configurações</span>
                  </button>
                  <button
                    onClick={async () => { setMenuOpen(false); await logout(); router.replace("/login"); }}
                    className="w-full text-left px-3 py-2 text-red-400 flex items-center gap-2 hover:bg-white/5"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Desconectar</span>
                  </button>
                </div>
              )}
            </div>
          </div>
          {user ? (
            <div className="text-xs text-muted">Logado como {user.displayName || user.email}</div>
          ) : (
            <div className="text-xs text-muted">Não autenticado</div>
          )}
        </div>

        <div className="p-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Pesquisar"
            className="w-full rounded px-3 py-2 bg-background border border-border text-foreground placeholder:text-muted"
          />
        </div>

        {error && (
          <div className="mx-3 mb-2 rounded border border-red-500/50 bg-red-500/10 p-3 text-xs text-red-300">
            {error}
          </div>
        )}

        <nav className="flex-1 overflow-y-auto">
          <div className="px-3 pb-2 text-xs uppercase text-muted">Conversas</div>
          <ul className="space-y-1 px-3">
            {displayed.map((c) => {
              const isGroup = c.type === "group";
              const otherUid = (c.members || []).find((m) => m !== user?.uid);
              const profile = otherUid ? profiles[otherUid] : undefined;
              const name = isGroup
                ? (c as any).name || `Grupo ${c.id.slice(0, 4)}`
                : profile?.displayName || profile?.email || otherUid || c.id;
              const avatar = isGroup ? (c as any).photoURL || null : profile?.photoURL || null;
              const initial = (name || "?").slice(0, 1).toUpperCase();
              const unread = ((c as any)?.unreadCounts || {})[user?.uid || ""] || 0;
              const isActive = activeChatId === c.id;
              return (
                <li key={c.id}>
                  <Link
                    href={`/chat/${c.id}`}
                    className="flex items-center gap-3 rounded px-3 py-2 hover:bg-white/5"
                  >
                    {avatar ? (
                      <img src={avatar} alt={name || "Avatar"} className="w-8 h-8 rounded-full object-cover" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-white/10 text-muted grid place-items-center text-sm">
                        {initial}
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{name}</div>
                      <div className="text-xs text-muted truncate">{c.lastMessage || "Sem mensagens"}</div>
                    </div>
                    {!isActive && unread > 0 && (
                      <span className="ml-auto inline-flex items-center justify-center min-w-[20px] h-6 px-2 rounded-full bg-primary text-white text-xs">
                        {unread}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
            {displayed.length === 0 && (
              <li className="text-xs text-muted px-3">Sem conversas</li>
            )}
          </ul>
        </nav>

        <div className="border-t border-border p-3 flex flex-col gap-2">
          <button onClick={() => { setNewOpen(true); setEmailInput(""); setTarget(null); setCreateError(null); }}
            className="text-xs text-white bg-primary hover:bg-primary/90 rounded px-2 py-1">
            Nova conversa
          </button>
          <button onClick={() => { setGroupOpen(true); setGroupName(""); setGroupDescription(""); setGroupPhotoURL(""); setSelectedMemberUids([]); setGroupError(null); }}
            className="text-xs text-white bg-primary hover:bg-primary/90 rounded px-2 py-1">
            Criar grupo
          </button>
        </div>
      </aside>

      {/* Chat area */}
      <section className={`${activeChatId ? "flex" : "hidden"} md:flex flex-col h-[100dvh] bg-background overflow-x-hidden`}>{children}</section>

      {/* Modal: Nova conversa */}
      {newOpen && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-4">
          <div className="bg-surface rounded border border-border shadow w-full max-w-md">
            <div className="border-b border-border p-3 flex items-center justify-between">
              <div className="font-medium">Iniciar nova conversa</div>
              <button onClick={() => setNewOpen(false)} className="text-muted">✕</button>
            </div>
            <div className="p-4 space-y-3">
              {!user && (
                <div className="rounded border border-yellow-500/50 bg-yellow-500/10 p-2 text-sm text-yellow-300">
                  Faça login para criar conversas.
                </div>
              )}
              <div className="space-y-2">
                <label className="text-sm">Email do usuário</label>
                <input
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  placeholder="usuario@exemplo.com"
                  className="w-full rounded px-3 py-2 bg-background border border-border text-foreground placeholder:text-muted"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => void findUserByEmail()}
                  className="px-3 py-2 bg-primary text-white rounded hover:bg-primary/90"
                  disabled={!emailInput.trim() || creating || searching}
                >
                  {searching ? "Buscando..." : "Buscar"}
                </button>
                {target && (
                  <button
                    onClick={() => void createOrOpenChat()}
                    className="px-3 py-2 bg-primary text-white rounded hover:bg-primary/90"
                    disabled={creating}
                  >
                    Iniciar conversa
                  </button>
                )}
              </div>
              {createError && (
                <div className="rounded border border-red-500/50 bg-red-500/10 p-2 text-sm text-red-300">
                  {createError}
                </div>
              )}
              {/* Lista de amigos para iniciar conversa rapidamente */}
              <div className="space-y-2">
                <div className="text-sm font-medium">Amigos</div>
                <div className="grid gap-2">
                  {friends.length === 0 && (
                    <div className="text-xs text-muted">Você ainda não adicionou amigos.</div>
                  )}
                  {friends.map((uid) => {
                    const fp = friendProfiles[uid] || {};
                    const label = fp.displayName || fp.email || uid;
                    const avatar = fp.photoURL || null;
                    return (
                      <div key={uid} className="flex items-center gap-2">
                        {avatar ? (
                          <img src={avatar} alt={label || "Avatar"} className="w-6 h-6 rounded-full object-cover" />
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-white/10 text-muted grid place-items-center text-xs">
                            {(label || "?").slice(0, 1).toUpperCase()}
                          </div>
                        )}
                        <div className="flex-1 min-w-0 truncate text-sm">{label}</div>
                        <button
                          className="px-2 py-1 text-xs rounded border border-border hover:bg-white/5"
                          onClick={() => setTarget({ uid, email: fp.email ?? null, displayName: fp.displayName ?? null, photoURL: fp.photoURL ?? null })}
                          disabled={creating}
                        >
                          Selecionar
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
              {/* Adicionar amigo por email */}
              <div className="space-y-2">
                <label className="text-sm">Adicionar amigo por email</label>
                <div className="flex gap-2">
                  <input
                    value={friendEmail}
                    onChange={(e) => setFriendEmail(e.target.value)}
                    placeholder="usuario@exemplo.com"
                    className="flex-1 rounded px-3 py-2 bg-background border border-border text-foreground placeholder:text-muted"
                  />
                  <button
                    onClick={() => void addFriendByEmail()}
                    className="px-3 py-2 bg-primary text-white rounded hover:bg-primary/90"
                    disabled={friendAdding || !friendEmail.trim()}
                  >
                    {friendAdding ? "Adicionando..." : "Adicionar"}
                  </button>
                </div>
                {friendError && (
                  <div className="rounded border border-red-500/50 bg-red-500/10 p-2 text-sm text-red-300">
                    {friendError}
                  </div>
                )}
              </div>
              {target && (
                <div className="rounded border border-border p-3">
                  <div className="text-sm">Usuário encontrado:</div>
                  <div className="text-sm font-medium">{target.displayName || target.email || target.uid}</div>
                  <div className="text-xs text-muted">{target.email}</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal: Criar grupo */}
      {groupOpen && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-4">
          <div className="bg-surface rounded border border-border shadow w-full max-w-lg">
            <div className="border-b border-border p-3 flex items-center justify-between">
              <div className="font-medium">Criar grupo</div>
              <button onClick={() => setGroupOpen(false)} className="text-muted">✕</button>
            </div>
            <div className="p-4 space-y-3">
              {!user && (
                <div className="rounded border border-yellow-500/50 bg-yellow-500/10 p-2 text-sm text-yellow-300">
                  Faça login para criar grupos.
                </div>
              )}
              <div className="flex items-center gap-3">
                {groupPhotoURL ? (
                  <img src={groupPhotoURL} alt={groupName || "Avatar"} className="w-12 h-12 rounded-full object-cover border" />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-white/10 text-muted grid place-items-center text-base">
                    {(groupName || "G").slice(0, 1).toUpperCase()}
                  </div>
                )}
                <div>
                  <input
                    type="file"
                    accept="image/*"
                    ref={groupAvatarInputRef}
                    className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadGroupPhoto(f); }}
                  />
                  <button
                    onClick={() => groupAvatarInputRef.current?.click()}
                    className="px-3 py-2 rounded border border-border hover:bg-white/5 text-sm"
                  >
                    📷 Enviar foto do grupo
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm">Nome do grupo</label>
                <input
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder="Meu grupo"
                  className="w-full rounded px-3 py-2 bg-background border border-border text-foreground placeholder:text-muted"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm">Descrição</label>
                <textarea
                  value={groupDescription}
                  onChange={(e) => setGroupDescription(e.target.value)}
                  placeholder="Sobre este grupo"
                  className="w-full rounded px-3 py-2 bg-background border border-border text-foreground placeholder:text-muted"
                />
              </div>
              <div className="space-y-2">
                <div className="text-sm font-medium">Adicionar membros</div>
                {/* Seleção de amigos */}
                <div className="grid gap-2">
                  {friends.length === 0 && (
                    <div className="text-xs text-muted">Você ainda não adicionou amigos.</div>
                  )}
                  {friends.map((uid) => {
                    const fp = friendProfiles[uid] || {};
                    const label = fp.displayName || fp.email || uid;
                    const avatar = fp.photoURL || null;
                    const checked = selectedMemberUids.includes(uid);
                    return (
                      <label key={uid} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleMember(uid)}
                        />
                        {avatar ? (
                          <img src={avatar} alt={label || "Avatar"} className="w-6 h-6 rounded-full object-cover" />
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-white/10 text-muted grid place-items-center text-xs">
                            {(label || "?").slice(0, 1).toUpperCase()}
                          </div>
                        )}
                        <span className="text-sm truncate">{label}</span>
                      </label>
                    );
                  })}
                </div>
                {/* Adicionar por email */}
                <div className="flex gap-2">
                  <input
                    value={memberEmail}
                    onChange={(e) => setMemberEmail(e.target.value)}
                    placeholder="usuario@exemplo.com"
                    className="flex-1 rounded px-3 py-2 bg-background border border-border text-foreground placeholder:text-muted"
                  />
                  <button
                    onClick={() => void addMemberByEmail()}
                    className="px-3 py-2 bg-primary text-white rounded hover:bg-primary/90"
                    disabled={memberSearching || !memberEmail.trim()}
                  >
                    {memberSearching ? "Buscando..." : "Adicionar"}
                  </button>
                </div>
                {/* Selecionados */}
                <div className="flex flex-wrap gap-2 text-xs">
                  {selectedMemberUids.map((uid) => {
                    const fp = friendProfiles[uid] || {};
                    const label = fp.displayName || fp.email || uid;
                    return (
                      <span key={uid} className="px-2 py-1 rounded border border-border">
                        {label}
                      </span>
                    );
                  })}
                </div>
              </div>
              {groupError && (
                <div className="rounded border border-red-500/50 bg-red-500/10 p-2 text-sm text-red-300">
                  {groupError}
                </div>
              )}
              <div className="flex gap-2">
                <button
                  onClick={() => setGroupOpen(false)}
                  className="px-3 py-2 rounded border border-border hover:bg-white/5"
                  disabled={groupCreating}
                >
                  Cancelar
                </button>
                <button
                  onClick={() => void createGroup()}
                  className="px-3 py-2 bg-primary text-white rounded hover:bg-primary/90"
                  disabled={groupCreating}
                >
                  {groupCreating ? "Criando..." : "Criar grupo"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Editar perfil */}
      {profileOpen && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-4">
          <div className="bg-surface rounded border border-border shadow w-full max-w-lg">
            <div className="border-b border-border p-3 flex items-center justify-between">
              <div className="font-medium">Editar perfil</div>
              <button onClick={() => setProfileOpen(false)} className="text-muted">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              {profileError && (
                <div className="rounded border border-red-500/50 bg-red-500/10 p-2 text-sm text-red-300">
                  {profileError}
                </div>
              )}
              <div className="space-y-2">
                <label className="text-sm">Nome de exibição</label>
                <input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Seu nome"
                  className="w-full rounded px-3 py-2 bg-background border border-border text-foreground placeholder:text-muted"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm">Avatar</label>
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
                    className="px-3 py-2 rounded border border-border flex items-center gap-2 hover:bg-white/5"
                    disabled={avatarUploading}
                  >
                    {avatarUploading ? "Enviando..." : (
                      <>
                        <Camera className="w-4 h-4" />
                        <span>Enviar avatar</span>
                      </>
                    )}
                  </button>
                  {photoURL && (
                    <img
                      src={photoURL}
                      alt="Avatar"
                      className="w-10 h-10 rounded-full object-cover border border-border"
                    />
                  )}
                </div>
                {profileInfo && (
                  <div className="rounded border border-green-500/50 bg-green-500/10 p-2 text-sm text-green-300">
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
                  className="w-full rounded px-3 py-2 bg-background border border-border text-foreground placeholder:text-muted"
                  rows={3}
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button onClick={() => setProfileOpen(false)} className="px-3 py-2 rounded border border-border hover:bg-white/5">Cancelar</button>
                <button
                  onClick={() => void saveProfile()}
                  className="px-3 py-2 rounded bg-primary text-white hover:bg-primary/90"
                  disabled={profileLoading}
                >
                  {profileLoading ? "Salvando..." : "Salvar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

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