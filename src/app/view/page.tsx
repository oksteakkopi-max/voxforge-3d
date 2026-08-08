"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Viewer3D from "@/components/Viewer3D";

function ViewInner() {
  const params = useSearchParams();
  const url = params.get("url");
  const [proxy, setProxy] = useState<string | null>(null);

  useEffect(() => {
    if (url) setProxy(`/api/model?url=${encodeURIComponent(url)}`);
  }, [url]);

  if (!url) {
    return (
      <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <p className="text-slate-500">URL model tidak valid.</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-extrabold mb-4">🧊 VoxForge 3D — Viewer</h1>
        {proxy && <Viewer3D modelUrl={proxy} />}
        <div className="mt-4 flex gap-3">
          <a href={url} target="_blank"
            className="bg-indigo-500 hover:bg-indigo-600 px-5 py-2 rounded-xl text-sm font-semibold">
            ⬇️ Download .glb
          </a>
          <button onClick={() => { navigator.clipboard.writeText(window.location.href); alert("Link disalin!"); }}
            className="bg-slate-800 hover:bg-slate-700 px-5 py-2 rounded-xl text-sm font-semibold">
            🔗 Copy Link
          </button>
        </div>
      </div>
    </main>
  );
}

export default function ViewPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">Loading...</div>}>
      <ViewInner />
    </Suspense>
  );
}
