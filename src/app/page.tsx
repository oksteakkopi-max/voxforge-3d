"use client";

import { useState, useEffect, useRef } from "react";
import JSZip from "jszip";
import Viewer3D from "@/components/Viewer3D";

type Item = {
  id: string;
  prompt: string;
  modelUrl: string | null;
  taskId?: string;
  baseModelTaskId?: string;
  status: "pending" | "running" | "done" | "error";
  progress?: number;
  error?: string;
};

const HISTORY_KEY = "voxforge_history";

const PRESETS: { cat: string; items: { label: string; prompt: string }[] }[] = [
  {
    cat: "🧙 Karakter",
    items: [
      { label: "Hero RPG", prompt: "a stylized RPG hero character, low poly, holding sword, T-pose, game asset" },
      { label: "Robot", prompt: "a humanoid robot character, blue body, standing pose, game asset" },
      { label: "Slime Monster", prompt: "a cute green slime monster, low poly, game enemy asset" },
      { label: "Knight", prompt: "a medieval knight in armor, stylized, A-pose, game character" },
      { label: "Anime Girl", prompt: "an anime style girl character, simple clothing, T-pose, game asset" },
    ],
  },
  {
    cat: "⚔️ Weapon",
    items: [
      { label: "Sword", prompt: "a fantasy sword, low poly, game weapon asset" },
      { label: "Shield", prompt: "a round wooden shield with metal rim, game asset" },
      { label: "Bow", prompt: "a wooden bow with string, low poly, game weapon" },
      { label: "Axe", prompt: "a battle axe, stylized, game weapon asset" },
      { label: "Potion", prompt: "a glowing red potion bottle, low poly, game item" },
    ],
  },
  {
    cat: "🏠 Props & Environment",
    items: [
      { label: "Chest", prompt: "a treasure chest, wooden with gold trim, game prop" },
      { label: "Tree", prompt: "a low poly stylized tree, game environment asset" },
      { label: "Rock", prompt: "a small rock cluster, low poly, game environment" },
      { label: "Crate", prompt: "a wooden crate, low poly, game prop" },
      { label: "Lamp", prompt: "a street lamp, stylized, game environment prop" },
    ],
  },
  {
    cat: "📦 Batch Starter",
    items: [
      { label: "Game Starter Pack", prompt: "a fantasy sword, low poly\na treasure chest, wooden\na cute slime monster\na stylized RPG hero, T-pose\na small rock cluster\na wooden crate" },
    ],
  },
];

export default function Home() {
  const [tab, setTab] = useState<"text" | "image">("text");
  const [prompt, setPrompt] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [active, setActive] = useState<Item | null>(null);
  const [busy, setBusy] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [retexturePrompt, setRetexturePrompt] = useState("");
  const [faceLimit, setFaceLimit] = useState(4000);
  const [resizeSize, setResizeSize] = useState(1.0);
  const [editBusy, setEditBusy] = useState(false);
  const [batchText, setBatchText] = useState("");
  const [currentAnim, setCurrentAnim] = useState<string | undefined>(undefined);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // load saved key + history
  useEffect(() => {
    const k = localStorage.getItem("tripo_key") || "";
    if (k) setApiKey(k);
    const h = localStorage.getItem(HISTORY_KEY);
    if (h) {
      try {
        const arr = JSON.parse(h) as Item[];
        setItems(arr);
        const done = arr.find((i) => i.status === "done" && i.modelUrl);
        if (done) setActive(done);
      } catch {}
    }
  }, []);

  function saveKey(v: string) {
    setApiKey(v);
    if (v) localStorage.setItem("tripo_key", v);
    else localStorage.removeItem("tripo_key");
  }

  function persist(list: Item[]) {
    setItems(list);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(0, 50)));
  }

  async function exportModel(format: "glb" | "obj" | "fbx" | "usdz" | "stl") {
    if (!active?.modelUrl || !apiKey) return;
    const taskId = active.baseModelTaskId || active.taskId || active.modelUrl.match(/tripo_pbr_model_([0-9a-f-]+)\./)?.[1];
    if (!taskId) { alert("URL model invalid"); return; }
    const r = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey, mode: "convert", taskId, format }),
    });
    const d = await r.json();
    if (!r.ok || !d.data?.task_id) { alert("Convert gagal: " + (d.error || "")); return; }
    const newId = d.data.task_id;
    for (let i = 0; i < 30; i++) {
      await new Promise((res) => setTimeout(res, 3000));
      const pr = await fetch(`/api/generate?taskId=${newId}&apiKey=${apiKey}`);
      const pd = await pr.json();
      if (pd.status === "success" && pd.modelUrl) {
        window.open(`/api/model?url=${encodeURIComponent(pd.modelUrl)}`, "_blank");
        return;
      }
      if (pd.status === "failed") { alert("Convert gagal"); return; }
    }
  }

  async function editModel(opts: {
    type: string;
    prompt?: string;
    faceLimit?: number;
    size?: number;
    rigType?: string;
    animType?: string;
  }) {
    if (!active?.modelUrl || !apiKey) { alert("Pilih model & isi API key dulu"); return; }
    const taskId = active.baseModelTaskId || active.taskId || active.modelUrl.match(/tripo_pbr_model_([0-9a-f-]+)\./)?.[1];
    if (!taskId) { alert("URL model invalid"); return; }
    setEditBusy(true);
    const r = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey, mode: "edit", type: opts.type, taskId, ...opts }),
    });
    const d = await r.json();
    if (!r.ok || !d.data?.task_id) { alert("Edit gagal: " + (d.error || "")); setEditBusy(false); return; }
    const newId = d.data.task_id;
    for (let i = 0; i < 40; i++) {
      await new Promise((res) => setTimeout(res, 3000));
      const pr = await fetch(`/api/generate?taskId=${newId}&apiKey=${apiKey}`);
      const pd = await pr.json();
      if (pd.status === "success" && pd.modelUrl) {
        const updated = { ...active, modelUrl: pd.modelUrl };
        setActive(updated);
        if (opts.type === "animate_rigging") setCurrentAnim(opts.animType || "idle");
        persist(items.map((it) => (it.id === active.id ? updated : it)));
        setEditBusy(false);
        return;
      }
      if (pd.status === "failed") { alert("Edit gagal"); setEditBusy(false); return; }
    }
    setEditBusy(false);
  }

  function onImage(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(f);
  }

  async function generateBatch() {
    if (busy) return;
    if (!apiKey) { alert("Isi Tripo API Key dulu"); return; }
    const lines = batchText.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) return;
    setBusy(true);
    const created: Item[] = [];
    for (const line of lines) {
      const tempId = crypto.randomUUID();
      const item: Item = { id: tempId, prompt: line, modelUrl: null, status: "running", progress: 0 };
      created.push(item);
      const next = [item, ...items];
      persist(next);
      setActive(item);
      try {
        const res = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode: "text", prompt: line, apiKey }),
        });
        const data = await res.json();
        if (!res.ok || !data.data?.task_id) throw new Error(data.error || "gagal");
        const taskId = data.data.task_id;
        let done = false;
        while (!done) {
          await new Promise((r) => setTimeout(r, 4000));
          const pr = await fetch(`/api/generate?taskId=${taskId}&apiKey=${apiKey}`);
          const pd = await pr.json();
          const upd = next.map((it) => (it.id === tempId ? { ...it, status: pd.status, progress: pd.progress, modelUrl: pd.modelUrl } : it));
          persist(upd);
          if (pd.status === "success" && pd.modelUrl) {
            done = true;
            persist(upd.map((it) => (it.id === tempId ? { ...it, status: "done" as const, modelUrl: pd.modelUrl, taskId } : it)));
          } else if (pd.status === "failed" || pd.status === "cancelled" || pd.error) {
            done = true;
            persist(upd.map((it) => (it.id === tempId ? { ...it, status: "error" as const, error: pd.error || "failed" } : it)));
          }
        }
      } catch (err: any) {
        persist(next.map((it) => (it.id === tempId ? { ...it, status: "error" as const, error: err.message } : it)));
      }
    }
    setBusy(false);
  }

  async function downloadAll() {
    const done = items.filter((i) => i.status === "done" && i.modelUrl);
    if (done.length === 0) { alert("Belum ada model selesai"); return; }
    const zip = new JSZip();
    for (const it of done) {
      try {
        const r = await fetch(`/api/model?url=${encodeURIComponent(it.modelUrl!)}`);
        const buf = await r.arrayBuffer();
        const name = (it.prompt || "model").replace(/[^a-z0-9]/gi, "_").slice(0, 30);
        zip.file(`${name}.glb`, buf);
      } catch {}
    }
    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "voxforge_models.zip";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function generate() {
    if (busy) return;
    if (!apiKey) { alert("Isi Tripo API Key dulu (gratis di platform.tripo3d.ai)"); return; }
    if (tab === "text" && !prompt.trim()) return;
    if (tab === "image" && !imagePreview) return;
    setBusy(true);
    const tempId = crypto.randomUUID();
    const item: Item = {
      id: tempId,
      prompt: tab === "text" ? prompt : "Image-to-3D",
      modelUrl: null,
      status: "running",
      progress: 0,
    };
    const next = [item, ...items];
    persist(next);
    setActive(item);

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: tab, prompt, imageDataUrl: imagePreview, apiKey }),
      });
      const data = await res.json();
      if (!res.ok || !data.data?.task_id) throw new Error(data.error || "gagal start task");
      const taskId = data.data.task_id;
      let done = false;
      while (!done) {
        await new Promise((r) => setTimeout(r, 4000));
        const pr = await fetch(`/api/generate?taskId=${taskId}&apiKey=${apiKey}`);
        const pd = await pr.json();
        const upd = next.map((it) =>
          it.id === tempId ? { ...it, status: pd.status, progress: pd.progress, modelUrl: pd.modelUrl } : it
        );
        persist(upd);
        if (pd.status === "success" && pd.modelUrl) {
          done = true;
          const fin = upd.map((it) => (it.id === tempId ? { ...it, status: "done" as const, modelUrl: pd.modelUrl, taskId, baseModelTaskId: taskId } : it));
          persist(fin);
          setActive(fin.find((i) => i.id === tempId) || null);
        } else if (pd.status === "failed" || pd.status === "cancelled" || pd.error) {
          done = true;
          const err = upd.map((it) => (it.id === tempId ? { ...it, status: "error" as const, error: pd.error || "failed" } : it));
          persist(err);
        }
      }
    } catch (err: any) {
      const errList = next.map((it) => (it.id === tempId ? { ...it, status: "error" as const, error: err.message } : it));
      persist(errList);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-5xl px-4 py-10">
        <h1 className="text-3xl font-extrabold tracking-tight">
          🧊 VoxForge 3D <span className="text-indigo-400">— Text & Image to 3D</span>
        </h1>
        <p className="mt-1 text-slate-400 text-sm">Buat & edit model 3D untuk game & animasi. Gratis: pakai Tripo API key kamu sendiri.</p>

        <div className="mt-4 rounded-2xl bg-slate-900 border border-slate-800 p-4">
          <label className="text-xs text-slate-400 font-semibold">Tripo API Key (gratis di platform.tripo3d.ai)</label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => saveKey(e.target.value)}
            placeholder="tsk_..."
            className="mt-1 w-full bg-slate-800 rounded-xl p-3 text-sm outline-none"
          />
          <p className="mt-1 text-[11px] text-slate-500">Disimpan di browser kamu. Riwayat model juga tersimpan lokal.</p>
        </div>

        <div className="mt-6 flex gap-2">
          {(["text", "image", "batch"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold ${tab === t ? "bg-indigo-500" : "bg-slate-800 hover:bg-slate-700"}`}
            >
              {t === "text" ? "✏️ Teks" : t === "image" ? "🖼️ Gambar" : "📦 Batch"}
            </button>
          ))}
        </div>

        <div className="mt-4 rounded-2xl bg-slate-900 border border-slate-800 p-5">
          <p className="text-xs text-slate-400 font-semibold mb-2">⚡ Preset Game Asset (klik untuk isi prompt)</p>
          <div className="space-y-3">
            {PRESETS.map((group) => (
              <div key={group.cat}>
                <p className="text-[11px] text-slate-500 mb-1">{group.cat}</p>
                <div className="flex flex-wrap gap-2">
                  {group.items.map((p) => (
                    <button
                      key={p.label}
                      onClick={() => {
                        if (p.prompt.includes("\n")) { setTab("batch"); setBatchText(p.prompt); }
                        else { setTab("text"); setPrompt(p.prompt); }
                      }}
                      className="bg-slate-800 hover:bg-indigo-600 px-3 py-1.5 rounded-lg text-xs font-medium"
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 rounded-2xl bg-slate-900 border border-slate-800 p-5">
          {tab === "text" ? (
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Deskripsikan objek 3D... mis. 'a cute robot cat, low poly, blue body'"
              className="w-full h-24 bg-slate-800 rounded-xl p-3 text-sm outline-none resize-none"
            />
          ) : tab === "image" ? (
            <div>
              <input ref={fileRef} type="file" accept="image/*" onChange={onImage} className="hidden" />
              <button
                onClick={() => fileRef.current?.click()}
                className="w-full h-32 rounded-xl border-2 border-dashed border-slate-700 flex items-center justify-center text-slate-400 hover:border-indigo-500"
              >
                {imagePreview ? "Ganti gambar" : "Klik untuk pilih gambar"}
              </button>
              {imagePreview && <img src={imagePreview} alt="preview" className="mt-3 h-32 rounded-lg object-cover" />}
            </div>
          ) : (
            <textarea
              value={batchText}
              onChange={(e) => setBatchText(e.target.value)}
              placeholder={"1 prompt per baris, mis:\na fantasy sword, low poly\na treasure chest, wooden\na cute slime monster"}
              className="w-full h-32 bg-slate-800 rounded-xl p-3 text-sm outline-none resize-none"
            />
          )}
          {tab === "batch" ? (
            <button
              onClick={generateBatch}
              disabled={busy}
              className="mt-4 w-full bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 py-3 rounded-xl font-bold"
            >
              {busy ? "Memproses batch..." : "📦 Generate Semua"}
            </button>
          ) : (
            <button
              onClick={generate}
              disabled={busy}
              className="mt-4 w-full bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 py-3 rounded-xl font-bold"
            >
              {busy ? "Memproses..." : "⚡ Generate 3D"}
            </button>
          )}
        </div>

        {active?.modelUrl && (
          <div className="mt-6 space-y-4">
            <Viewer3D modelUrl={`/api/model?url=${encodeURIComponent(active.modelUrl)}`} animName={currentAnim} />
            {currentAnim && (
              <p className="text-center text-xs text-indigo-400">▶️ Animasi: {currentAnim}</p>
            )}

            <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4">
              <p className="text-sm font-semibold text-slate-300 mb-2">📦 Export (game engine)</p>
              <div className="flex flex-wrap gap-2">
                {(["glb", "obj", "fbx", "usdz", "stl"] as const).map((fmt) => (
                  <button key={fmt} onClick={() => exportModel(fmt)} disabled={!apiKey}
                    className="bg-slate-800 hover:bg-slate-700 disabled:opacity-40 px-4 py-2 rounded-xl text-sm font-semibold uppercase">
                    .{fmt}
                  </button>
                ))}
              </div>
              <button onClick={() => {
                const link = `${window.location.origin}/view?url=${encodeURIComponent(active.modelUrl!)}`;
                navigator.clipboard.writeText(link);
                setShareUrl(link);
                setTimeout(() => setShareUrl(null), 4000);
              }}
                className="mt-3 w-full bg-slate-800 hover:bg-indigo-600 px-4 py-2 rounded-xl text-sm font-semibold">
                🔗 Share Link (copy)
              </button>
              {shareUrl && <p className="mt-2 text-xs text-green-400">✅ Link disalin: {shareUrl.slice(0, 50)}...</p>}
            </div>

            <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4">
              <p className="text-sm font-semibold text-slate-300 mb-2">🎮 Game & Animasi</p>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => editModel({ type: "rigging", rigType: "game" })} disabled={editBusy || !apiKey}
                  className="bg-slate-800 hover:bg-slate-700 disabled:opacity-40 px-4 py-2 rounded-xl text-sm font-semibold">🦴 Auto-Rig</button>
              </div>
              <p className="text-xs text-slate-500 mt-3 mb-1">▶️ Preview Animasi:</p>
              <div className="flex flex-wrap gap-2">
                {["walk", "run", "idle", "jump", "wave", "dance_01", "attack_01", "sit", "crouch", "death_01"].map((a) => (
                  <button key={a} onClick={() => editModel({ type: "animate_rigging", animType: a })} disabled={editBusy || !apiKey}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium ${currentAnim === a ? "bg-indigo-500" : "bg-slate-800 hover:bg-slate-700 disabled:opacity-40"}`}>
                    {a.replace("_", " ")}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4">
              <p className="text-sm font-semibold text-slate-300 mb-2">🎨 Edit Model</p>
              <div className="space-y-3">
                <div>
                  <input value={retexturePrompt} onChange={(e) => setRetexturePrompt(e.target.value)}
                    placeholder="Retexture: mis. 'wooden texture, dark brown'"
                    className="w-full bg-slate-800 rounded-xl p-2 text-sm outline-none" />
                  <button onClick={() => editModel({ type: "retexture", prompt: retexturePrompt })} disabled={editBusy || !apiKey || !retexturePrompt}
                    className="mt-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 px-4 py-2 rounded-xl text-sm font-semibold">↻ Retexture</button>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">Remesh faces:</span>
                  <input type="number" value={faceLimit} onChange={(e) => setFaceLimit(Number(e.target.value))}
                    className="w-24 bg-slate-800 rounded-xl p-2 text-sm outline-none" />
                  <button onClick={() => editModel({ type: "remesh", faceLimit })} disabled={editBusy || !apiKey}
                    className="bg-slate-800 hover:bg-slate-700 disabled:opacity-40 px-4 py-2 rounded-xl text-sm font-semibold">Remesh</button>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">Resize (m):</span>
                  <input type="number" step="0.1" value={resizeSize} onChange={(e) => setResizeSize(Number(e.target.value))}
                    className="w-24 bg-slate-800 rounded-xl p-2 text-sm outline-none" />
                  <button onClick={() => editModel({ type: "resize_model", size: resizeSize })} disabled={editBusy || !apiKey}
                    className="bg-slate-800 hover:bg-slate-700 disabled:opacity-40 px-4 py-2 rounded-xl text-sm font-semibold">Resize</button>
                </div>
                <button onClick={() => editModel({ type: "uv_unwrap" })} disabled={editBusy || !apiKey}
                  className="bg-slate-800 hover:bg-slate-700 disabled:opacity-40 px-4 py-2 rounded-xl text-sm font-semibold">🧩 UV Unwrap</button>
              </div>
              {editBusy && <p className="mt-2 text-sm text-indigo-400">⏳ Memproses edit...</p>}
            </div>
          </div>
        )}

        <div className="mt-8 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-200">📚 Gallery ({items.length})</h2>
          <button onClick={downloadAll}
            className="bg-slate-800 hover:bg-indigo-600 px-4 py-2 rounded-xl text-sm font-semibold">
            📦 Download Semua (.zip)
          </button>
        </div>
        <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-4">
          {items.map((it) => (
            <button
              key={it.id}
              onClick={() => it.modelUrl && setActive(it)}
              className={`rounded-xl bg-slate-900 border p-4 text-left ${active?.id === it.id ? "border-indigo-400" : "border-slate-800"}`}
            >
              <p className="text-xs text-slate-400 truncate">{it.prompt}</p>
              {it.status === "running" && <p className="mt-2 text-sm text-indigo-400">⏳ {Math.round((it.progress || 0) * 100)}%</p>}
              {it.status === "done" && it.modelUrl && <p className="mt-2 text-sm text-green-400">✅ Klik untuk lihat</p>}
              {it.status === "error" && <p className="mt-2 text-sm text-red-400">❌ {it.error}</p>}
            </button>
          ))}
        </div>
        {items.length === 0 && (
          <p className="mt-8 text-center text-slate-600 text-sm">Belum ada model. Generate pertama kamu!</p>
        )}
      </div>
    </main>
  );
}
