"use client";
import Link from "next/link";
import { useAuth } from "@/lib/auth";

export default function Home() {
  const { user, configured, loading } = useAuth();
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="border-b border-border p-4">
        <h1 className="text-xl font-semibold">DKChat</h1>
      </header>
      <main className="flex-1 p-6 space-y-4">
        {!configured && (
          <div className="rounded border border-yellow-500/50 bg-yellow-500/10 p-3 text-sm text-yellow-300">
            Configure o Firebase em <code>.env.local</code> para habilitar login e chat.
          </div>
        )}
        {loading ? (
          <div>Carregando...</div>
        ) : user ? (
          <div className="space-y-3">
            <p className="text-muted">Você está logado como {user.displayName || user.email}.</p>
            <Link href="/chat" className="px-4 py-2 bg-primary text-white rounded hover:bg-primary/90">Abrir Chat</Link>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-muted">Faça login para acessar seus chats.</p>
            <Link href="/login" className="px-4 py-2 bg-primary text-white rounded hover:bg-primary/90">Login</Link>
          </div>
        )}
      </main>
      <footer className="border-t border-border p-4 text-sm text-muted">{new Date().getFullYear()}</footer>
    </div>
  );
}
