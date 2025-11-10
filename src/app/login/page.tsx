"use client";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { useState } from "react";

export default function LoginPage() {
  const { signInGoogle, configured, loading, user } = useAuth();
  const [error, setError] = useState<string | null>(null);

  if (!configured) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md w-full space-y-4">
          <h1 className="text-2xl font-bold">Configuração necessária</h1>
          <p className="text-sm text-gray-600">
            Preencha <code>.env.local</code> com as credenciais do Firebase (veja <code>.env.local.example</code>)
            e reinicie o dev server.
          </p>
          <Link href="/" className="text-blue-600">Voltar</Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return <div className="min-h-screen grid place-items-center">Carregando...</div>;
  }

  if (user) {
    return (
      <div className="min-h-screen grid place-items-center p-6">
        <div className="space-y-4 text-center">
          <p className="text-lg">Você já está logado como {user.displayName || user.email}</p>
          <Link href="/" className="px-4 py-2 bg-black text-white rounded">Ir para Home</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen grid place-items-center p-6">
      <div className="space-y-6 max-w-md w-full">
        <h1 className="text-2xl font-bold">Entrar</h1>
        <p className="text-sm text-gray-600">Use sua conta Google para entrar.</p>
        {error && (
          <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}
        <button
          onClick={async () => {
            setError(null);
            try {
              await signInGoogle();
            } catch (e: any) {
              const code: string | undefined = e?.code;
              if (code === "auth/operation-not-allowed") {
                setError(
                  "Operação não permitida: habilite o provedor Google em Firebase Console > Authentication > Sign-in method. Também adicione 'localhost' em Authorized Domains."
                );
              } else if (code === "auth/unauthorized-domain") {
                setError(
                  "Domínio não autorizado: adicione 'localhost' (e seu domínio de produção) em Authentication > Settings > Authorized domains."
                );
              } else if (code === "auth/popup-blocked") {
                setError("Popup bloqueado pelo navegador: tente permitir popups ou usar outra janela.");
              } else if (code === "auth/popup-closed-by-user") {
                setError("Popup fechado antes de concluir o login. Tente novamente.");
              } else {
                setError(`Erro ao entrar: ${code || "verifique a configuração do Firebase"}`);
              }
            }
          }}
          className="w-full bg-blue-600 text-white rounded px-4 py-2 hover:bg-blue-700"
        >
          Entrar com Google
        </button>
      </div>
    </div>
  );
}