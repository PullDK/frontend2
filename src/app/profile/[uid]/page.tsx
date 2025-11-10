import { notFound } from "next/navigation";

export default function ProfilePage({ params }: { params: { uid: string } }) {
  const { uid } = params;
  if (!uid) return notFound();
  return (
    <div className="h-full p-6 space-y-4">
      <h1 className="text-xl font-semibold">Perfil</h1>
      <p className="text-sm text-muted">UID: {uid}</p>
      <p className="text-sm text-muted">Conteúdo do perfil em construção.</p>
    </div>
  );
}