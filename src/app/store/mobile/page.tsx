"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth";
import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { Frame, Type, Award, MessageSquare, LayoutGrid, SquareDashedMousePointer, Palette, ShoppingCart, Check } from "lucide-react";

type Cosmetics = {
  avatarStyle?: "none" | "rgb" | "gold" | "neon" | "sunset" | "ocean" | "forest" | "candy" | "galaxy" | "matrix" | "fire";
  avatarAnim?: "none" | "pulse" | "spin";
  nameStyle?: "green" | "blue" | "purple" | "rgb" | "rose" | "cyan" | "orange" | "lime" | "sky" | "fuchsia" | "amber" | "teal" | "indigo";
  nameAnim?: "none" | "pulse" | "gradient";
  badge?: "none" | "crown" | "star" | "flame" | "bolt" | "diamond" | "heart" | "rocket" | "ghost" | "music" | "coffee"
    | "trophy" | "medal" | "sparkles" | "balloon" | "gift" | "skull" | "snowflake" | "sun" | "moon" | "leaf" | "alien" | "ufo";
  badgeAnim?: "none" | "bounce" | "pulse" | "spin" | "wiggle" | "float" | "beat" | "flicker" | "twinkle";
  bubbleStyle?:
    | "default"
    | "rounded_md"
    | "rounded_xl"
    | "glass"
    | "glass_blue"
    | "glass_purple"
    | "glow"
    | "wireframe"
    | "wireframe_dotted"
    | "shadow"
    | "neon_purple"
    | "neon_blue"
    | "neon_green"
    | "neon_pink"
    | "neon_yellow"
    | "neon_red"
    | "neon_cyan"
    | "neon_rainbow"
    | "denim"
    | "outline_thick"
    | "outline_glow_blue"
    | "outline_glow_pink"
    | "gradient_surface"
    | "stripes"
    | "grid";
  bubbleAnim?: "none" | "pulse" | "flicker" | "breath";
  modalBg?: "surface" | "glass" | "gradient_emerald" | "gradient_night" | "pattern_dots" | "pattern_grid" | "pattern_stripes";
  modalFrame?: "border" | "rounded_xl" | "wireframe" | "neon_emerald" | "neon_violet";
  modalAccent?: "emerald" | "violet" | "cyan" | "rose" | "amber" | "indigo";
};

type Item = {
  id: string;
  category: "avatarFrame" | "nameStyle" | "badge" | "bubbleStyle" | "modalBg" | "modalFrame" | "modalAccent";
  label: string;
  price: number;
  preview: React.ReactElement;
  apply: Partial<Cosmetics>;
};

export default function MobileStorePage() {
  const { user } = useAuth();
  const [coins, setCoins] = useState<number>(0);
  const [inventory, setInventory] = useState<string[]>([]);
  const [equipped, setEquipped] = useState<Cosmetics>({
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
  const [info, setInfo] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<"avatarFrame" | "nameStyle" | "badge" | "bubbleStyle" | "modalBg" | "modalFrame" | "modalAccent">("avatarFrame");
  const [page, setPage] = useState<number>(1);
  const itemsPerPage = 6; // mobile-first

  const ITEMS: Item[] = useMemo(() => [
    // Molduras de avatar
    { id: "avatar_rgb",    category: "avatarFrame", label: "Moldura RGB", price: 300, preview: <div className="p-[2px] rounded-full bg-gradient-to-r from-pink-500 via-yellow-500 to-indigo-500 w-12 h-12"><img src="https://i.pravatar.cc/48" alt="preview" className="w-full h-full rounded-full object-cover border border-transparent" /></div>, apply: { avatarStyle: "rgb" } },
    { id: "avatar_rgb_spin",    category: "avatarFrame", label: "Moldura RGB (girando)", price: 340, preview: (
      <div className="relative inline-block w-12 h-12 rounded-full overflow-hidden">
        <span className="absolute inset-0 rounded-full animate-[spin_3s_linear_infinite] bg-[conic-gradient(from_0deg,_#ec4899,_#f59e0b,_#6366f1,_#ec4899)]"></span>
        <img src="https://i.pravatar.cc/48" alt="preview" className="absolute inset-[2px] rounded-full object-cover border border-transparent" />
      </div>
    ), apply: { avatarStyle: "rgb", avatarAnim: "spin" } },
    { id: "avatar_gold",   category: "avatarFrame", label: "Moldura Dourada", price: 280, preview: <div className="p-[2px] rounded-full bg-gradient-to-r from-yellow-400 to-amber-600 w-12 h-12"><img src="https://i.pravatar.cc/48?img=5" alt="preview" className="w-full h-full rounded-full object-cover border border-transparent" /></div>, apply: { avatarStyle: "gold" } },
    { id: "avatar_neon",   category: "avatarFrame", label: "Moldura Néon", price: 280, preview: <div className="p-[2px] rounded-full bg-gradient-to-r from-cyan-400 to-fuchsia-500 w-12 h-12"><img src="https://i.pravatar.cc/48?img=3" alt="preview" className="w-full h-full rounded-full object-cover border border-transparent" /></div>, apply: { avatarStyle: "neon" } },
    { id: "avatar_sunset", category: "avatarFrame", label: "Moldura Sunset", price: 260, preview: <div className="p-[2px] rounded-full bg-gradient-to-r from-orange-400 via-pink-500 to-purple-600 w-12 h-12"><img src="https://i.pravatar.cc/48?img=7" alt="preview" className="w-full h-full rounded-full object-cover border border-transparent" /></div>, apply: { avatarStyle: "sunset" } },
    { id: "avatar_ocean",  category: "avatarFrame", label: "Moldura Ocean", price: 260, preview: <div className="p-[2px] rounded-full bg-gradient-to-r from-sky-400 via-cyan-500 to-blue-600 w-12 h-12"><img src="https://i.pravatar.cc/48?img=8" alt="preview" className="w-full h-full rounded-full object-cover border border-transparent" /></div>, apply: { avatarStyle: "ocean" } },
    { id: "avatar_forest", category: "avatarFrame", label: "Moldura Forest", price: 260, preview: <div className="p-[2px] rounded-full bg-gradient-to-r from-emerald-400 via-green-500 to-lime-600 w-12 h-12"><img src="https://i.pravatar.cc/48?img=9" alt="preview" className="w-full h-full rounded-full object-cover border border-transparent" /></div>, apply: { avatarStyle: "forest" } },
    { id: "avatar_candy",  category: "avatarFrame", label: "Moldura Candy", price: 240, preview: <div className="p-[2px] rounded-full bg-gradient-to-r from-pink-400 via-rose-500 to-amber-400 w-12 h-12"><img src="https://i.pravatar.cc/48?img=10" alt="preview" className="w-full h-full rounded-full object-cover border border-transparent" /></div>, apply: { avatarStyle: "candy" } },
    { id: "avatar_galaxy", category: "avatarFrame", label: "Moldura Galaxy", price: 300, preview: <div className="p-[2px] rounded-full bg-gradient-to-r from-indigo-500 via-fuchsia-500 to-violet-600 w-12 h-12"><img src="https://i.pravatar.cc/48?img=11" alt="preview" className="w-full h-full rounded-full object-cover border border-transparent" /></div>, apply: { avatarStyle: "galaxy" } },
    { id: "avatar_matrix", category: "avatarFrame", label: "Moldura Matrix", price: 260, preview: <div className="p-[2px] rounded-full bg-gradient-to-r from-lime-400 via-emerald-500 to-green-600 w-12 h-12"><img src="https://i.pravatar.cc/48?img=12" alt="preview" className="w-full h-full rounded-full object-cover border border-transparent" /></div>, apply: { avatarStyle: "matrix" } },
    { id: "avatar_fire",   category: "avatarFrame", label: "Moldura Fire (anim)", price: 320, preview: <div className="p-[2px] rounded-full bg-gradient-to-r from-red-500 via-orange-500 to-amber-500 w-12 h-12 animate-pulse"><img src="https://i.pravatar.cc/48?img=13" alt="preview" className="w-full h-full rounded-full object-cover border border-transparent" /></div>, apply: { avatarStyle: "fire", avatarAnim: "pulse" } },
    // Nome
    { id: "name_blue",    category: "nameStyle", label: "Nome Azul", price: 160, preview: <span className="text-blue-400 font-semibold">Seu Nome</span>, apply: { nameStyle: "blue" } },
    { id: "name_purple",  category: "nameStyle", label: "Nome Roxo", price: 160, preview: <span className="text-violet-400 font-semibold">Seu Nome</span>, apply: { nameStyle: "purple" } },
    { id: "name_rgb",     category: "nameStyle", label: "Nome Gradiente", price: 220, preview: <span className="bg-gradient-to-r from-pink-500 via-yellow-500 to-indigo-500 bg-clip-text text-transparent font-semibold">Seu Nome</span>, apply: { nameStyle: "rgb" } },
    { id: "name_rgb_move",category: "nameStyle", label: "Nome Gradiente ", price: 260, preview: <span className="bg-gradient-to-r from-pink-500 via-yellow-500 to-indigo-500 bg-clip-text text-transparent font-semibold animate-gradient-x">Seu Nome</span>, apply: { nameStyle: "rgb", nameAnim: "gradient" } },
    { id: "name_rose",    category: "nameStyle", label: "Nome Rose", price: 150, preview: <span className="text-rose-400 font-semibold">Seu Nome</span>, apply: { nameStyle: "rose" } },
    { id: "name_cyan",    category: "nameStyle", label: "Nome Cyan", price: 150, preview: <span className="text-cyan-400 font-semibold">Seu Nome</span>, apply: { nameStyle: "cyan" } },
    { id: "name_orange",  category: "nameStyle", label: "Nome Laranja", price: 150, preview: <span className="text-orange-400 font-semibold">Seu Nome</span>, apply: { nameStyle: "orange" } },
    { id: "name_lime",    category: "nameStyle", label: "Nome Lima", price: 150, preview: <span className="text-lime-400 font-semibold">Seu Nome</span>, apply: { nameStyle: "lime" } },
    { id: "name_sky",     category: "nameStyle", label: "Nome Sky", price: 150, preview: <span className="text-sky-400 font-semibold">Seu Nome</span>, apply: { nameStyle: "sky" } },
    { id: "name_fuchsia", category: "nameStyle", label: "Nome Fúcsia (anim)", price: 180, preview: <span className="text-fuchsia-400 font-semibold animate-pulse">Seu Nome</span>, apply: { nameStyle: "fuchsia", nameAnim: "pulse" } },
    { id: "name_amber",   category: "nameStyle", label: "Nome Âmbar", price: 150, preview: <span className="text-amber-400 font-semibold">Seu Nome</span>, apply: { nameStyle: "amber" } },
    // Badges
    { id: "badge_crown",  category: "badge", label: "Coroa", price: 250, preview: <span className="text-yellow-400 text-xl">👑</span>, apply: { badge: "crown" } },
    { id: "badge_star",   category: "badge", label: "Estrela", price: 220, preview: <span className="text-yellow-300 text-xl">⭐</span>, apply: { badge: "star" } },
    { id: "badge_flame",  category: "badge", label: "Chama (anim)", price: 240, preview: <span className="text-red-500 text-xl animate-pulse">🔥</span>, apply: { badge: "flame", badgeAnim: "pulse" } },
    { id: "badge_bolt",   category: "badge", label: "Raio (bounce)", price: 240, preview: <span className="text-yellow-400 text-xl animate-bounce">⚡</span>, apply: { badge: "bolt", badgeAnim: "bounce" } },
    { id: "badge_diamond",category: "badge", label: "Diamante", price: 300, preview: <span className="text-cyan-300 text-xl">💎</span>, apply: { badge: "diamond" } },
    { id: "badge_heart",  category: "badge", label: "Coração", price: 220, preview: <span className="text-rose-400 text-xl">❤️</span>, apply: { badge: "heart" } },
    { id: "badge_rocket", category: "badge", label: "Foguete", price: 260, preview: <span className="text-indigo-400 text-xl">🚀</span>, apply: { badge: "rocket" } },
    { id: "badge_ghost",  category: "badge", label: "Fantasma", price: 220, preview: <span className="text-slate-300 text-xl">👻</span>, apply: { badge: "ghost" } },
    { id: "badge_music",  category: "badge", label: "Música", price: 200, preview: <span className="text-emerald-400 text-xl">🎵</span>, apply: { badge: "music" } },
    { id: "badge_coffee", category: "badge", label: "Café", price: 200, preview: <span className="text-amber-600 text-xl">☕</span>, apply: { badge: "coffee" } },
    { id: "badge_trophy", category: "badge", label: "Troféu (pulse)", price: 260, preview: <span className="text-yellow-400 text-xl animate-pulse">🏆</span>, apply: { badge: "trophy", badgeAnim: "pulse" } },
    { id: "badge_medal", category: "badge", label: "Medalha (wiggle)", price: 260, preview: <span className="text-yellow-300 text-xl animate-wiggle">🥇</span>, apply: { badge: "medal", badgeAnim: "wiggle" } },
    { id: "badge_sparkles", category: "badge", label: "Brilhos (twinkle)", price: 260, preview: <span className="text-yellow-200 text-xl animate-twinkle">✨</span>, apply: { badge: "sparkles", badgeAnim: "twinkle" } },
    { id: "badge_balloon", category: "badge", label: "Balão (float)", price: 240, preview: <span className="text-rose-400 text-xl animate-float">🎈</span>, apply: { badge: "balloon", badgeAnim: "float" } },
    { id: "badge_gift", category: "badge", label: "Presente (wiggle)", price: 240, preview: <span className="text-pink-400 text-xl animate-wiggle">🎁</span>, apply: { badge: "gift", badgeAnim: "wiggle" } },
    { id: "badge_skull", category: "badge", label: "Caveira (wiggle)", price: 240, preview: <span className="text-slate-300 text-xl animate-wiggle">💀</span>, apply: { badge: "skull", badgeAnim: "wiggle" } },
    { id: "badge_snowflake", category: "badge", label: "Floco de neve (float)", price: 240, preview: <span className="text-cyan-300 text-xl animate-float">❄️</span>, apply: { badge: "snowflake", badgeAnim: "float" } },
    { id: "badge_sun", category: "badge", label: "Sol (spin)", price: 260, preview: <span className="text-amber-400 text-xl animate-spin">☀️</span>, apply: { badge: "sun", badgeAnim: "spin" } },
    { id: "badge_moon", category: "badge", label: "Lua (float)", price: 240, preview: <span className="text-indigo-300 text-xl animate-float">🌙</span>, apply: { badge: "moon", badgeAnim: "float" } },
    { id: "badge_leaf", category: "badge", label: "Folha (float)", price: 240, preview: <span className="text-emerald-400 text-xl animate-float">🍃</span>, apply: { badge: "leaf", badgeAnim: "float" } },
    { id: "badge_alien", category: "badge", label: "Alien (wiggle)", price: 260, preview: <span className="text-green-400 text-xl animate-wiggle">👽</span>, apply: { badge: "alien", badgeAnim: "wiggle" } },
    { id: "badge_ufo", category: "badge", label: "UFO (float/spin)", price: 280, preview: <span className="text-sky-300 text-xl animate-float">🛸</span>, apply: { badge: "ufo", badgeAnim: "float" } },
    // Bolha
    { id: "bubble_glow",    category: "bubbleStyle", label: "Bolha Glow", price: 260, preview: <div className="inline-block rounded-lg px-3 py-2 bg-surface text-foreground border border-border shadow-[0_0_10px_rgba(16,185,129,0.45)] ring-1 ring-emerald-500/50">Exemplo</div>, apply: { bubbleStyle: "glow" } },
    { id: "bubble_glass",   category: "bubbleStyle", label: "Bolha Glass", price: 240, preview: <div className="inline-block rounded-lg px-3 py-2 backdrop-blur bg-white/5 border border-white/10 text-foreground">Exemplo</div>, apply: { bubbleStyle: "glass" } },
    { id: "bubble_round_md",category: "bubbleStyle", label: "Arredondada md", price: 140, preview: <div className="inline-block rounded-md px-3 py-2 bg-surface text-foreground border border-border">Exemplo</div>, apply: { bubbleStyle: "rounded_md" } },
    { id: "bubble_round_xl",category: "bubbleStyle", label: "Arredondada xl", price: 140, preview: <div className="inline-block rounded-xl px-3 py-2 bg-surface text-foreground border border-border">Exemplo</div>, apply: { bubbleStyle: "rounded_xl" } },
    { id: "bubble_wireframe",category: "bubbleStyle", label: "Wireframe", price: 160, preview: <div className="inline-block rounded-lg px-3 py-2 bg-surface border-2 border-dashed">Exemplo</div>, apply: { bubbleStyle: "wireframe" } },
    { id: "bubble_shadow",  category: "bubbleStyle", label: "Sombra", price: 160, preview: <div className="inline-block rounded-lg px-3 py-2 bg-surface border border-border shadow-lg">Exemplo</div>, apply: { bubbleStyle: "shadow" } },
    { id: "bubble_neon_purple", category: "bubbleStyle", label: "Neon roxo", price: 200, preview: <div className="inline-block rounded-lg px-3 py-2 bg-surface border border-border ring-1 ring-violet-500/60 shadow-[0_0_10px_rgba(139,92,246,0.45)]">Exemplo</div>, apply: { bubbleStyle: "neon_purple" } },
    { id: "bubble_denim",   category: "bubbleStyle", label: "Denim", price: 160, preview: <div className="inline-block rounded-lg px-3 py-2 bg-surface border border-sky-600 ring-1 ring-sky-500/40">Exemplo</div>, apply: { bubbleStyle: "denim" } },
    { id: "bubble_outline_thick", category: "bubbleStyle", label: "Borda grossa", price: 160, preview: <div className="inline-block rounded-lg px-3 py-2 bg-surface border-2">Exemplo</div>, apply: { bubbleStyle: "outline_thick" } },
    { id: "bubble_gradient_surface", category: "bubbleStyle", label: "Gradiente", price: 200, preview: <div className="inline-block rounded-lg px-3 py-2 bg-gradient-to-br from-indigo-500/10 to-emerald-500/10 border border-white/10 text-foreground">Exemplo</div>, apply: { bubbleStyle: "gradient_surface", bubbleAnim: "pulse" } },
    { id: "bubble_neon_blue", category: "bubbleStyle", label: "Neon azul", price: 200, preview: <div className="inline-block rounded-lg px-3 py-2 bg-surface text-foreground border border-border ring-1 ring-sky-500/60 shadow-[0_0_12px_rgba(56,189,248,0.5)]">Exemplo</div>, apply: { bubbleStyle: "neon_blue" } },
    { id: "bubble_neon_green", category: "bubbleStyle", label: "Neon verde", price: 200, preview: <div className="inline-block rounded-lg px-3 py-2 bg-surface text-foreground border border-border ring-1 ring-emerald-500/60 shadow-[0_0_12px_rgba(16,185,129,0.5)]">Exemplo</div>, apply: { bubbleStyle: "neon_green" } },
    { id: "bubble_neon_pink_v2", category: "bubbleStyle", label: "Neon rosa", price: 200, preview: <div className="inline-block rounded-lg px-3 py-2 bg-surface text-foreground border border-border ring-1 ring-pink-500/60 shadow-[0_0_12px_rgba(236,72,153,0.5)]">Exemplo</div>, apply: { bubbleStyle: "neon_pink" } },
    { id: "bubble_neon_yellow", category: "bubbleStyle", label: "Neon amarelo", price: 200, preview: <div className="inline-block rounded-lg px-3 py-2 bg-surface text-foreground border border-border ring-1 ring-yellow-400/60 shadow-[0_0_12px_rgba(250,204,21,0.5)]">Exemplo</div>, apply: { bubbleStyle: "neon_yellow" } },
    { id: "bubble_neon_red", category: "bubbleStyle", label: "Neon vermelho", price: 200, preview: <div className="inline-block rounded-lg px-3 py-2 bg-surface text-foreground border border-border ring-1 ring-red-500/60 shadow-[0_0_12px_rgba(239,68,68,0.5)]">Exemplo</div>, apply: { bubbleStyle: "neon_red" } },
    { id: "bubble_neon_cyan", category: "bubbleStyle", label: "Neon ciano", price: 200, preview: <div className="inline-block rounded-lg px-3 py-2 bg-surface text-foreground border border-border ring-1 ring-cyan-500/60 shadow-[0_0_12px_rgba(6,182,212,0.5)]">Exemplo</div>, apply: { bubbleStyle: "neon_cyan" } },
    { id: "bubble_neon_rainbow", category: "bubbleStyle", label: "Neon arco-íris", price: 240, preview: <div className="inline-block rounded-lg px-3 py-2 bg-gradient-to-r from-pink-500/10 via-yellow-500/10 to-indigo-500/10 text-foreground border border-white/10 ring-1 ring-white/20 shadow-[0_0_12px_rgba(255,255,255,0.3)]">Exemplo</div>, apply: { bubbleStyle: "neon_rainbow" } },
    { id: "bubble_glass_blue", category: "bubbleStyle", label: "Glass azul", price: 220, preview: <div className="inline-block rounded-lg px-3 py-2 backdrop-blur bg-sky-500/10 border border-sky-200/20 ring-1 ring-sky-500/30">Exemplo</div>, apply: { bubbleStyle: "glass_blue" } },
    { id: "bubble_glass_purple", category: "bubbleStyle", label: "Glass roxo", price: 220, preview: <div className="inline-block rounded-lg px-3 py-2 backdrop-blur bg-violet-500/10 border border-violet-200/20 ring-1 ring-violet-500/30">Exemplo</div>, apply: { bubbleStyle: "glass_purple" } },
    { id: "bubble_outline_glow_blue", category: "bubbleStyle", label: "Borda brilho azul", price: 200, preview: <div className="inline-block rounded-lg px-3 py-2 bg-surface border-2 border-sky-400 ring-1 ring-sky-400/50 shadow-[0_0_12px_rgba(56,189,248,0.4)]">Exemplo</div>, apply: { bubbleStyle: "outline_glow_blue" } },
    { id: "bubble_outline_glow_pink", category: "bubbleStyle", label: "Borda brilho rosa", price: 200, preview: <div className="inline-block rounded-lg px-3 py-2 bg-surface border-2 border-pink-400 ring-1 ring-pink-400/50 shadow-[0_0_12px_rgba(236,72,153,0.4)]">Exemplo</div>, apply: { bubbleStyle: "outline_glow_pink" } },
    { id: "bubble_wireframe_dotted", category: "bubbleStyle", label: "Wireframe pontilhado", price: 180, preview: <div className="inline-block rounded-lg px-3 py-2 bg-surface border-2 border-dotted border-white/30">Exemplo</div>, apply: { bubbleStyle: "wireframe_dotted" } },
    { id: "bubble_stripes", category: "bubbleStyle", label: "Listras", price: 180, preview: <div className="inline-block rounded-lg px-3 py-2 bg-[repeating-linear-gradient(45deg,rgba(99,102,241,0.08)_0_12px,transparent_12px_24px)] border border-white/10">Exemplo</div>, apply: { bubbleStyle: "stripes" } },
    { id: "bubble_grid", category: "bubbleStyle", label: "Grade", price: 180, preview: <div className="inline-block rounded-lg px-3 py-2 bg-[linear-gradient(rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(to_right,rgba(255,255,255,0.08)_1px,transparent_1px)] bg-[size:20px_20px] border border-white/10">Exemplo</div>, apply: { bubbleStyle: "grid" } },
    { id: "bubble_anim_flicker", category: "bubbleStyle", label: "Animação Flicker", price: 120, preview: <div className="inline-block rounded-lg px-3 py-2 bg-surface border border-border animate-flicker">Exemplo</div>, apply: { bubbleAnim: "flicker" } },
    { id: "bubble_anim_breath", category: "bubbleStyle", label: "Animação Breath", price: 120, preview: <div className="inline-block rounded-lg px-3 py-2 bg-surface border border-border animate-breath">Exemplo</div>, apply: { bubbleAnim: "breath" } },
    // Modal BG
    { id: "modal_bg_surface", category: "modalBg", label: "Fundo padrão", price: 150, preview: (
      <div className="w-20 h-14 rounded border border-border bg-surface relative">
        <div className="absolute top-0 left-0 right-0 h-4 bg-emerald-700 rounded-t" />
      </div>
    ), apply: { modalBg: "surface" } },
    { id: "modal_bg_glass", category: "modalBg", label: "Fundo Glass", price: 180, preview: (
      <div className="w-20 h-14 rounded border border-white/20 backdrop-blur bg-white/10 relative">
        <div className="absolute top-0 left-0 right-0 h-4 bg-emerald-700 rounded-t" />
      </div>
    ), apply: { modalBg: "glass" } },
    { id: "modal_bg_gradient_emerald", category: "modalBg", label: "Gradiente Emerald", price: 220, preview: (
      <div className="w-20 h-14 rounded border border-white/20 bg-gradient-to-br from-emerald-950/70 via-emerald-800/40 to-emerald-700/30 relative">
        <div className="absolute top-0 left-0 right-0 h-4 bg-emerald-700 rounded-t" />
      </div>
    ), apply: { modalBg: "gradient_emerald" } },
    { id: "modal_bg_gradient_night", category: "modalBg", label: "Gradiente Night", price: 220, preview: (
      <div className="w-20 h-14 rounded border border-white/20 bg-gradient-to-br from-slate-950/70 via-indigo-900/40 to-violet-900/30 relative">
        <div className="absolute top-0 left-0 right-0 h-4 bg-emerald-700 rounded-t" />
      </div>
    ), apply: { modalBg: "gradient_night" } },
    { id: "modal_bg_pattern_dots", category: "modalBg", label: "Padrão: Pontos", price: 180, preview: (
      <div className="w-20 h-14 rounded border border-white/20 bg-[radial-gradient(circle_at_1px_1px,_rgba(255,255,255,0.08)_1px,_transparent_1px)] bg-[length:18px_18px] relative">
        <div className="absolute top-0 left-0 right-0 h-4 bg-emerald-700 rounded-t" />
      </div>
    ), apply: { modalBg: "pattern_dots" } },
    { id: "modal_bg_pattern_grid", category: "modalBg", label: "Padrão: Grade", price: 180, preview: (
      <div className="w-20 h-14 rounded border border-white/20 bg-[linear-gradient(to_right,rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.08)_1px,transparent_1px)] bg-[size:18px_18px] relative">
        <div className="absolute top-0 left-0 right-0 h-4 bg-emerald-700 rounded-t" />
      </div>
    ), apply: { modalBg: "pattern_grid" } },
    { id: "modal_bg_pattern_stripes", category: "modalBg", label: "Padrão: Listras", price: 180, preview: (
      <div className="w-20 h-14 rounded border border-white/20 bg-[repeating-linear-gradient(45deg,rgba(255,255,255,0.08)_0_10px,transparent_10px_20px)] relative">
        <div className="absolute top-0 left-0 right-0 h-4 bg-emerald-700 rounded-t" />
      </div>
    ), apply: { modalBg: "pattern_stripes" } },
    // Moldura modal
    { id: "modal_frame_border", category: "modalFrame", label: "Moldura padrão", price: 150, preview: (
      <div className="w-20 h-14 bg-surface border border-border rounded relative">
        <div className="absolute top-0 left-0 right-0 h-4 bg-emerald-700 rounded-t" />
      </div>
    ), apply: { modalFrame: "border" } },
    { id: "modal_frame_rounded_xl", category: "modalFrame", label: "Moldura arredondada", price: 180, preview: (
      <div className="w-20 h-14 bg-surface border border-border rounded-xl relative">
        <div className="absolute top-0 left-0 right-0 h-4 bg-emerald-700 rounded-t-xl" />
      </div>
    ), apply: { modalFrame: "rounded_xl" } },
    { id: "modal_frame_wireframe", category: "modalFrame", label: "Wireframe (tracejado)", price: 180, preview: (
      <div className="w-20 h-14 bg-transparent border-2 border-dashed rounded relative">
        <div className="absolute top-0 left-0 right-0 h-4 bg-emerald-700" />
      </div>
    ), apply: { modalFrame: "wireframe" } },
    { id: "modal_frame_neon_emerald", category: "modalFrame", label: "Moldura Néon Emerald", price: 220, preview: (
      <div className="w-20 h-14 bg-surface ring-1 ring-emerald-500/60 shadow-[0_0_12px_rgba(16,185,129,0.35)] border-transparent rounded relative">
        <div className="absolute top-0 left-0 right-0 h-4 bg-emerald-700" />
      </div>
    ), apply: { modalFrame: "neon_emerald" } },
    { id: "modal_frame_neon_violet", category: "modalFrame", label: "Moldura Néon Violeta", price: 220, preview: (
      <div className="w-20 h-14 bg-surface ring-1 ring-violet-500/60 shadow-[0_0_12px_rgba(139,92,246,0.35)] border-transparent rounded relative">
        <div className="absolute top-0 left-0 right-0 h-4 bg-emerald-700" />
      </div>
    ), apply: { modalFrame: "neon_violet" } },
    // Acento modal
    { id: "modal_accent_emerald", category: "modalAccent", label: "Acento Emerald", price: 150, preview: <div className="w-20 h-4 rounded bg-emerald-700" />, apply: { modalAccent: "emerald" } },
    { id: "modal_accent_violet", category: "modalAccent", label: "Acento Violeta", price: 150, preview: <div className="w-20 h-4 rounded bg-violet-700" />, apply: { modalAccent: "violet" } },
    { id: "modal_accent_cyan", category: "modalAccent", label: "Acento Ciano", price: 150, preview: <div className="w-20 h-4 rounded bg-cyan-700" />, apply: { modalAccent: "cyan" } },
    { id: "modal_accent_rose", category: "modalAccent", label: "Acento Rose", price: 150, preview: <div className="w-20 h-4 rounded bg-rose-700" />, apply: { modalAccent: "rose" } },
    { id: "modal_accent_amber", category: "modalAccent", label: "Acento Âmbar", price: 150, preview: <div className="w-20 h-4 rounded bg-amber-600" />, apply: { modalAccent: "amber" } },
    { id: "modal_accent_indigo", category: "modalAccent", label: "Acento Índigo", price: 150, preview: <div className="w-20 h-4 rounded bg-indigo-700" />, apply: { modalAccent: "indigo" } },
  ], []);

  useEffect(() => {
    (async () => {
      if (!db || !user?.uid) return;
      try {
        const uref = doc(db, "users", user.uid);
        const snap = await getDoc(uref);
        const data = snap.exists() ? (snap.data() as any) : {};
        setCoins(typeof data?.coins === "number" ? data.coins : 500);
        setInventory(Array.isArray(data?.inventory) ? data.inventory : []);
        const c = data?.cosmetics || {};
        setEquipped({
          avatarStyle: c?.avatarStyle ?? "none",
          avatarAnim: c?.avatarAnim ?? "none",
          nameStyle: c?.nameStyle ?? "green",
          nameAnim: c?.nameAnim ?? "none",
          badge: c?.badge ?? "none",
          badgeAnim: c?.badgeAnim ?? "none",
          bubbleStyle: c?.bubbleStyle ?? "default",
          bubbleAnim: c?.bubbleAnim ?? "none",
          modalBg: c?.modalBg ?? "surface",
          modalFrame: c?.modalFrame ?? "border",
          modalAccent: c?.modalAccent ?? "emerald",
        });
      } catch {}
    })();
  }, [db, user?.uid]);

  async function dailyClaim() {
    try {
      if (!db || !user?.uid) return;
      const uref = doc(db, "users", user.uid);
      const snap = await getDoc(uref);
      const data = snap.exists() ? (snap.data() as any) : {};
      const today = new Date().toDateString();
      if (data?.dailyClaimAt === today) {
        setInfo("Recompensa diária já coletada hoje.");
        return;
      }
      const nextCoins = (typeof data?.coins === "number" ? data.coins : coins) + 50;
      await setDoc(uref, { coins: nextCoins, dailyClaimAt: today }, { merge: true });
      setCoins(nextCoins);
      setInfo("+50 moedas adicionadas!");
    } catch {}
  }

  function owned(id: string) {
    return inventory.includes(id);
  }

  async function buyItem(item: Item) {
    if (!db || !user?.uid) return;
    if (owned(item.id)) {
      setInfo("Você já possui este item.");
      return;
    }
    if (coins < item.price) {
      setInfo("Moedas insuficientes.");
      return;
    }
    try {
      const uref = doc(db, "users", user.uid);
      const nextCoins = coins - item.price;
      const nextInv = [...inventory, item.id];
      await setDoc(uref, { coins: nextCoins, inventory: nextInv }, { merge: true });
      setCoins(nextCoins);
      setInventory(nextInv);
      setInfo(`Comprado: ${item.label}`);
    } catch {}
  }

  async function equipItem(item: Item) {
    if (!db || !user?.uid) return;
    if (!owned(item.id)) {
      setInfo("Compre o item antes de equipar.");
      return;
    }
    try {
      const uref = doc(db, "users", user.uid);
      const next = { ...(equipped || {}), ...item.apply };
      await setDoc(uref, { cosmetics: next }, { merge: true });
      setEquipped(next);
      setInfo(`Equipado: ${item.label}`);
      const raw = localStorage.getItem("dkchat.cosmetics");
      const current = raw ? JSON.parse(raw) : {};
      localStorage.setItem("dkchat.cosmetics", JSON.stringify({ ...current, ...item.apply }));
      window.dispatchEvent(new Event("dkchat:cosmetics-updated"));
    } catch {}
  }

  function isEquipped(item: Item) {
    const key = Object.keys(item.apply)[0] as keyof Cosmetics;
    // @ts-ignore
    return equipped?.[key] === item.apply[key];
  }

  const filtered = ITEMS.filter((it) => it.category === activeCategory);
  const totalPages = Math.max(1, Math.ceil(filtered.length / itemsPerPage));
  const pageItems = filtered.slice((page - 1) * itemsPerPage, (page - 1) * itemsPerPage + itemsPerPage);

  return (
    <div className="min-h-[100dvh] w-full max-w-full touch-pan-y">
      <div className="container mx-auto max-w-screen-sm sm:max-w-screen-md lg:max-w-screen-lg px-3 sm:px-4 md:px-6 py-3 sm:py-4">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-base sm:text-lg font-semibold truncate">Loja (Mobile)</h1>
          <Link href="/store" className="text-xs px-2 py-1 rounded border border-border hover:bg-white/5">Versão completa</Link>
        </div>

        <div className="rounded border border-border bg-surface p-3 sm:p-4 mb-3">
          <div className="flex items-center gap-2">
            <div className="inline-flex items-center gap-2 px-2 py-[2px] rounded-full bg-amber-500/10 ring-1 ring-amber-500/40 text-amber-300 text-xs" title="Seu saldo">
              <span className="font-semibold">Moedas:</span>
              <span className="font-semibold">{coins}</span>
            </div>
            <button
              className="px-2 py-1 rounded border border-transparent bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 ring-1 ring-emerald-500/40 text-xs"
              onClick={dailyClaim}
              title="Coletar +50 moedas hoje"
            >
              +50 diária
            </button>
            <Link href="/chat" className="px-2 py-1 rounded border border-border hover:bg-white/5 text-xs" title="Voltar ao chat">
              Voltar
            </Link>
          </div>
        </div>

        {info && <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-2 text-xs text-amber-200 mb-3">{info}</div>}

        <div className="rounded border border-border bg-surface p-3 sm:p-4 space-y-3 mb-3">
          <div className="text-sm sm:text-base font-medium">Sua prévia</div>
          <div className="flex items-start gap-3">
            <div className={(
              (equipped.avatarStyle === "rgb" && equipped.avatarAnim === "spin") ? "relative inline-block w-10 h-10 rounded-full overflow-hidden" :
              (equipped.avatarStyle === "rgb" ? "p-[2px] rounded-full bg-gradient-to-r from-pink-500 via-yellow-500 to-indigo-500" :
              equipped.avatarStyle === "gold" ? "p-[2px] rounded-full bg-gradient-to-r from-yellow-400 to-amber-600" :
              equipped.avatarStyle === "neon" ? "p-[2px] rounded-full bg-gradient-to-r from-cyan-400 to-fuchsia-500" :
              equipped.avatarStyle === "sunset" ? "p-[2px] rounded-full bg-gradient-to-r from-orange-400 via-pink-500 to-purple-600" :
              equipped.avatarStyle === "ocean" ? "p-[2px] rounded-full bg-gradient-to-r from-sky-400 via-cyan-500 to-blue-600" :
              equipped.avatarStyle === "forest" ? "p-[2px] rounded-full bg-gradient-to-r from-emerald-400 via-green-500 to-lime-600" :
              equipped.avatarStyle === "candy" ? "p-[2px] rounded-full bg-gradient-to-r from-pink-400 via-rose-500 to-amber-400" :
              equipped.avatarStyle === "galaxy" ? "p-[2px] rounded-full bg-gradient-to-r from-indigo-500 via-fuchsia-500 to-violet-600" :
              equipped.avatarStyle === "matrix" ? "p-[2px] rounded-full bg-gradient-to-r from-lime-400 via-emerald-500 to-green-600" :
              equipped.avatarStyle === "fire" ? "p-[2px] rounded-full bg-gradient-to-r from-red-500 via-orange-500 to-amber-500" : "") + (equipped.avatarAnim === "pulse" ? " animate-pulse" : "")
            )}>
              {equipped.avatarStyle === "rgb" && equipped.avatarAnim === "spin" ? (
                <>
                  <span className="absolute inset-0 rounded-full animate-[spin_3s_linear_infinite] bg-[conic-gradient(from_0deg,_#ec4899,_#f59e0b,_#6366f1,_#ec4899)]"></span>
                  <img src="https://i.pravatar.cc/48?img=12" alt="avatar" className="absolute inset-[2px] rounded-full object-cover border border-transparent" />
                </>
              ) : (
                <img src="https://i.pravatar.cc/48?img=12" alt="avatar" className="w-10 h-10 rounded-full object-cover border border-transparent" />
              )}
            </div>
            <div className={(
              (equipped.bubbleStyle === "glow") ? "inline-block px-3 py-2 rounded-lg shadow-[0_0_10px_rgba(16,185,129,0.45)] ring-1 ring-emerald-500/50 bg-surface border border-border" :
              (equipped.bubbleStyle === "glass") ? "inline-block px-3 py-2 rounded-lg backdrop-blur bg-white/5 border border-white/10" :
              (equipped.bubbleStyle === "glass_blue") ? "inline-block px-3 py-2 rounded-lg backdrop-blur bg-sky-500/10 border border-sky-200/20 ring-1 ring-sky-500/30" :
              (equipped.bubbleStyle === "glass_purple") ? "inline-block px-3 py-2 rounded-lg backdrop-blur bg-violet-500/10 border border-violet-200/20 ring-1 ring-violet-500/30" :
              (equipped.bubbleStyle === "rounded_md") ? "inline-block px-3 py-2 rounded-md bg-surface border border-border" :
              (equipped.bubbleStyle === "rounded_xl") ? "inline-block px-3 py-2 rounded-xl bg-surface border border-border" :
              (equipped.bubbleStyle === "wireframe") ? "inline-block px-3 py-2 rounded-lg bg-surface border-2 border-dashed" :
              (equipped.bubbleStyle === "wireframe_dotted") ? "inline-block px-3 py-2 rounded-lg bg-surface border-2 border-dotted border-white/30" :
              (equipped.bubbleStyle === "shadow") ? "inline-block px-3 py-2 rounded-lg bg-surface border border-border shadow-lg" :
              (equipped.bubbleStyle === "neon_purple") ? "inline-block px-3 py-2 rounded-lg bg-surface border border-border ring-1 ring-violet-500/60 shadow-[0_0_10px_rgba(139,92,246,0.45)]" :
              (equipped.bubbleStyle === "neon_blue") ? "inline-block px-3 py-2 rounded-lg bg-surface border border-border ring-1 ring-sky-500/60 shadow-[0_0_12px_rgba(56,189,248,0.5)]" :
              (equipped.bubbleStyle === "neon_green") ? "inline-block px-3 py-2 rounded-lg bg-surface border border-border ring-1 ring-emerald-500/60 shadow-[0_0_12px_rgba(16,185,129,0.5)]" :
              (equipped.bubbleStyle === "neon_pink") ? "inline-block px-3 py-2 rounded-lg bg-surface border border-border ring-1 ring-pink-500/60 shadow-[0_0_12px_rgba(236,72,153,0.5)]" :
              (equipped.bubbleStyle === "neon_yellow") ? "inline-block px-3 py-2 rounded-lg bg-surface border border-border ring-1 ring-yellow-400/60 shadow-[0_0_12px_rgba(250,204,21,0.5)]" :
              (equipped.bubbleStyle === "neon_red") ? "inline-block px-3 py-2 rounded-lg bg-surface border border-border ring-1 ring-red-500/60 shadow-[0_0_12px_rgba(239,68,68,0.5)]" :
              (equipped.bubbleStyle === "neon_cyan") ? "inline-block px-3 py-2 rounded-lg bg-surface border border-border ring-1 ring-cyan-500/60 shadow-[0_0_12px_rgba(6,182,212,0.5)]" :
              (equipped.bubbleStyle === "neon_rainbow") ? "inline-block px-3 py-2 rounded-lg bg-gradient-to-r from-pink-500/10 via-yellow-500/10 to-indigo-500/10 text-foreground border border-white/10 ring-1 ring-white/20 shadow-[0_0_12px_rgba(255,255,255,0.3)]" :
              (equipped.bubbleStyle === "denim") ? "inline-block px-3 py-2 rounded-lg bg-surface border border-sky-600 ring-1 ring-sky-500/40" :
              (equipped.bubbleStyle === "outline_thick") ? "inline-block px-3 py-2 rounded-lg bg-surface border-2" :
              (equipped.bubbleStyle === "outline_glow_blue") ? "inline-block px-3 py-2 rounded-lg bg-surface border-2 border-sky-400 ring-1 ring-sky-400/50 shadow-[0_0_12px_rgba(56,189,248,0.4)]" :
              (equipped.bubbleStyle === "outline_glow_pink") ? "inline-block px-3 py-2 rounded-lg bg-surface border-2 border-pink-400 ring-1 ring-pink-400/50 shadow-[0_0_12px_rgba(236,72,153,0.4)]" :
              (equipped.bubbleStyle === "gradient_surface") ? "inline-block px-3 py-2 rounded-lg bg-gradient-to-br from-indigo-500/10 to-emerald-500/10 border border-white/10" :
              (equipped.bubbleStyle === "stripes") ? "inline-block px-3 py-2 rounded-lg bg-[repeating-linear-gradient(45deg,rgba(99,102,241,0.08)_0_12px,transparent_12px_24px)] border border-white/10" :
              (equipped.bubbleStyle === "grid") ? "inline-block px-3 py-2 rounded-lg bg-[linear-gradient(rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(to_right,rgba(255,255,255,0.08)_1px,transparent_1px)] bg-[size:20px_20px] border border-white/10" :
              "inline-block px-3 py-2 rounded-lg bg-surface border border-border"
            ) + (
              equipped.bubbleAnim === "pulse" ? " animate-pulse" :
              equipped.bubbleAnim === "flicker" ? " animate-flicker" :
              equipped.bubbleAnim === "breath" ? " animate-breath" : ""
            )}>
              <div className="text-xs font-semibold mb-1 truncate">
                {equipped.nameStyle === "rgb" ? (
                  <span className={("bg-gradient-to-r from-pink-500 via-yellow-500 to-indigo-500 bg-clip-text text-transparent" + (equipped.nameAnim === "pulse" ? " animate-pulse" : equipped.nameAnim === "gradient" ? " animate-gradient-x bg-[length:200%_200%]" : ""))}>Seu Nome</span>
                ) : equipped.nameStyle === "blue" ? (
                  <span className={("text-blue-400" + (equipped.nameAnim === "pulse" ? " animate-pulse" : ""))}>Seu Nome</span>
                ) : equipped.nameStyle === "purple" ? (
                  <span className={("text-violet-400" + (equipped.nameAnim === "pulse" ? " animate-pulse" : ""))}>Seu Nome</span>
                ) : equipped.nameStyle === "rose" ? (
                  <span className={("text-rose-400" + (equipped.nameAnim === "pulse" ? " animate-pulse" : ""))}>Seu Nome</span>
                ) : equipped.nameStyle === "cyan" ? (
                  <span className={("text-cyan-400" + (equipped.nameAnim === "pulse" ? " animate-pulse" : ""))}>Seu Nome</span>
                ) : equipped.nameStyle === "orange" ? (
                  <span className={("text-orange-400" + (equipped.nameAnim === "pulse" ? " animate-pulse" : ""))}>Seu Nome</span>
                ) : equipped.nameStyle === "lime" ? (
                  <span className={("text-lime-400" + (equipped.nameAnim === "pulse" ? " animate-pulse" : ""))}>Seu Nome</span>
                ) : equipped.nameStyle === "sky" ? (
                  <span className={("text-sky-400" + (equipped.nameAnim === "pulse" ? " animate-pulse" : ""))}>Seu Nome</span>
                ) : equipped.nameStyle === "fuchsia" ? (
                  <span className={("text-fuchsia-400" + (equipped.nameAnim === "pulse" ? " animate-pulse" : ""))}>Seu Nome</span>
                ) : equipped.nameStyle === "amber" ? (
                  <span className={("text-amber-400" + (equipped.nameAnim === "pulse" ? " animate-pulse" : ""))}>Seu Nome</span>
                ) : equipped.nameStyle === "teal" ? (
                  <span className={("text-teal-400" + (equipped.nameAnim === "pulse" ? " animate-pulse" : ""))}>Seu Nome</span>
                ) : equipped.nameStyle === "indigo" ? (
                  <span className={("text-indigo-400" + (equipped.nameAnim === "pulse" ? " animate-pulse" : ""))}>Seu Nome</span>
                ) : (
                  <span className={("text-emerald-400" + (equipped.nameAnim === "pulse" ? " animate-pulse" : ""))}>Seu Nome</span>
                )}
                {(() => {
                  const animCls =
                    equipped.badgeAnim === "bounce" ? " animate-bounce" :
                    equipped.badgeAnim === "pulse" ? " animate-pulse" :
                    equipped.badgeAnim === "spin" ? " animate-spin" :
                    equipped.badgeAnim === "wiggle" ? " animate-wiggle" :
                    equipped.badgeAnim === "float" ? " animate-float" :
                    equipped.badgeAnim === "beat" ? " animate-beat" :
                    equipped.badgeAnim === "flicker" ? " animate-flicker" :
                    equipped.badgeAnim === "twinkle" ? " animate-twinkle" : "";
                  const cls = "ml-1" + animCls;
                  switch (equipped.badge) {
                    case "crown": return <span className={cls}>👑</span>;
                    case "star": return <span className={cls}>⭐</span>;
                    case "flame": return <span className={cls}>🔥</span>;
                    case "bolt": return <span className={cls}>⚡</span>;
                    case "diamond": return <span className={cls}>💎</span>;
                    case "heart": return <span className={cls}>❤️</span>;
                    case "rocket": return <span className={cls}>🚀</span>;
                    case "ghost": return <span className={cls}>👻</span>;
                    case "music": return <span className={cls}>🎵</span>;
                    case "coffee": return <span className={cls}>☕</span>;
                    case "trophy": return <span className={cls}>🏆</span>;
                    case "medal": return <span className={cls}>🥇</span>;
                    case "sparkles": return <span className={cls}>✨</span>;
                    case "balloon": return <span className={cls}>🎈</span>;
                    case "gift": return <span className={cls}>🎁</span>;
                    case "skull": return <span className={cls}>💀</span>;
                    case "snowflake": return <span className={cls}>❄️</span>;
                    case "sun": return <span className={cls}>☀️</span>;
                    case "moon": return <span className={cls}>🌙</span>;
                    case "leaf": return <span className={cls}>🍃</span>;
                    case "alien": return <span className={cls}>👽</span>;
                    case "ufo": return <span className={cls}>🛸</span>;
                    default: return null;
                  }
                })()}
              </div>
              <div className="whitespace-pre-wrap break-words text-sm">Olá! Esta é a sua aparência no chat.</div>
            </div>
          </div>
        </div>

        {/* Navegação por categorias mobile: scroll horizontal e snap */}
        <div className="rounded border border-border bg-surface p-3 sm:p-4 mb-3">
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar snap-x snap-mandatory">
            {[
              { key: "avatarFrame", label: "Molduras", icon: Frame },
              { key: "nameStyle", label: "Nome", icon: Type },
              { key: "badge", label: "Badges", icon: Award },
              { key: "bubbleStyle", label: "Bolha", icon: MessageSquare },
              { key: "modalBg", label: "Fundo", icon: LayoutGrid },
              { key: "modalFrame", label: "Moldura", icon: SquareDashedMousePointer },
              { key: "modalAccent", label: "Acento", icon: Palette },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => { setActiveCategory(tab.key as any); setPage(1); }}
                className={("px-2 py-1 rounded border text-xs inline-flex items-center gap-1 snap-start " +
                  (activeCategory === tab.key ? "bg-primary text-white border-transparent" : "border-border hover:bg-white/5"))}
                aria-pressed={activeCategory === tab.key}
                title={tab.label}
              >
                {tab.icon && <tab.icon className="w-4 h-4" />}
                <span className="truncate max-w-[10ch] sm:max-w-none">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Grid de itens responsivo */}
        <div className="rounded border border-border bg-surface p-3 sm:p-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {pageItems.map((it) => (
              <div key={it.id} className="rounded-lg border border-border p-3 hover:bg-white/5 transition-colors h-[120px] flex flex-col justify-between" title={it.label}>
                <div className="flex items-center gap-3">
                  <div className="min-w-[3rem] flex items-center justify-center">{it.preview}</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium break-words whitespace-normal flex items-center gap-2">
                      <span className="truncate">{it.label}</span>
                      {owned(it.id) && !isEquipped(it) && (
                        <span className="text-[10px] px-2 py-[2px] rounded-full bg-white/10 border border-white/20">No inventário</span>
                      )}
                    </div>
                    <div className="text-xs text-muted">{it.price} moedas</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 justify-end mt-3">
                  {!owned(it.id) ? (
                    <button
                      className="px-2 py-1 text-xs rounded border border-border hover:bg-white/5 inline-flex items-center gap-1"
                      onClick={() => buyItem(it)}
                      disabled={coins < it.price}
                      title={coins < it.price ? "Moedas insuficientes" : "Comprar"}
                    >
                      <ShoppingCart className="w-4 h-4" />
                      <span>Comprar</span>
                    </button>
                  ) : isEquipped(it) ? (
                    <span className="px-2 py-1 rounded bg-emerald-500/20 text-emerald-200 text-xs ring-1 ring-emerald-500/40 inline-flex items-center gap-1">
                      <Check className="w-4 h-4" />
                      <span>Equipado</span>
                    </span>
                  ) : (
                    <button className="px-2 py-1 text-xs rounded bg-primary text-white inline-flex items-center gap-1" onClick={() => equipItem(it)} title="Equipar">
                      <Check className="w-4 h-4" />
                      <span>Equipar</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
          {/* Paginação */}
          <div className="flex items-center justify-between gap-2 pt-3">
            <div className="text-xs text-muted">Página {page} de {totalPages}</div>
            <div className="flex items-center gap-2">
              <button
                className="px-2 py-1 text-xs rounded border border-border hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                title="Página anterior"
              >
                ← Anterior
              </button>
              <button
                className="px-2 py-1 text-xs rounded border border-border hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                title="Próxima página"
              >
                Próxima →
              </button>
            </div>
          </div>
        </div>

        <div className="text-xs text-muted mt-3">Compras e equipamentos são salvos no seu perfil e ficam visíveis para outras pessoas.</div>
      </div>
    </div>
  );
}