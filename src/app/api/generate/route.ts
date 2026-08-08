import { NextRequest, NextResponse } from "next/server";

const TRIPO_BASE = "https://api.tripo3d.ai/v2/openapi";
const ENV_KEY = process.env.TRIPO_API_KEY;

export const dynamic = "force-dynamic";

function getKey(req: NextRequest, body?: any): string | null {
  const fromBody = body?.apiKey;
  const fromQuery = req.nextUrl.searchParams.get("apiKey");
  return fromBody || fromQuery || ENV_KEY || null;
}

async function tripoFetch(path: string, key: string, init?: RequestInit) {
  const res = await fetch(`${TRIPO_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });
  const text = await res.text();
  let data: any = null;
  try { data = JSON.parse(text); } catch {}
  if (!res.ok) {
    return NextResponse.json(
      { error: data?.message || data?.error || text || `Tripo HTTP ${res.status}` },
      { status: res.status }
    );
  }
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const key = getKey(req, body);
  if (!key) {
    return NextResponse.json(
      { error: "Masukkan Tripo API Key kamu (gratis di platform.tripo3d.ai)" },
      { status: 400 }
    );
  }
  const { prompt, imageDataUrl, mode, type, taskId, format, style, texture, pbr, faceLimit, rigType, animType, size } = body;

  if (mode === "image" && imageDataUrl) {
    const base64 = imageDataUrl.split(",")[1];
    const r = await tripoFetch("/task", key, {
      method: "POST",
      body: JSON.stringify({
        type: "image_to_model",
        file: { type: "base64", file_name: "input.png", base64 },
        ...(style ? { model_version: style } : {}),
        ...(pbr !== undefined ? { pbr } : {}),
        ...(faceLimit ? { face_limit: faceLimit } : {}),
      }),
    });
    return r;
  }

  if (mode === "text" && prompt) {
    const r = await tripoFetch("/task", key, {
      method: "POST",
      body: JSON.stringify({
        type: "text_to_model",
        prompt,
        ...(style ? { model_version: style } : {}),
        ...(pbr !== undefined ? { pbr } : {}),
        ...(faceLimit ? { face_limit: faceLimit } : {}),
      }),
    });
    return r;
  }

  if (mode === "convert" && taskId && format) {
    const r = await tripoFetch("/task", key, {
      method: "POST",
      body: JSON.stringify({
        type: "convert_model",
        original_model_task_id: taskId,
        format,
      }),
    });
    return r;
  }

  if (mode === "edit" && type && taskId) {
    const typeMap: Record<string, string> = {
      retexture: "texture_model",
      remesh: "highpoly_to_lowpoly",
      resize_model: "convert_model",
      uv_unwrap: "uv_unwrap",
      rigging: "rigging_pipeline",
      animate_rigging: "animate_retarget",
    };
    const tripoType = typeMap[type] || type;
    const payload: any = { type: tripoType, original_model_task_id: taskId };
    if (type === "retexture" && prompt) payload.prompt = prompt;
    if (type === "remesh" && faceLimit) { payload.face_limit = faceLimit; payload.quad = false; }
    if (type === "resize_model" && size) payload.size = size;
    if (type === "rigging") { payload.type = "animate_rig"; payload.out_format = "glb"; payload.rig_type = rigType || "biped"; }
    if (type === "animate_rigging") {
      payload.type = "animate_retarget";
      payload.out_format = "glb";
      payload.bake_animation = true;
      payload.animation = `preset:biped:${animType || "idle"}`;
    }
    const r = await tripoFetch("/task", key, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return r;
  }

  return NextResponse.json({ error: "prompt atau image wajib" }, { status: 400 });
}

export async function GET(req: NextRequest) {
  const taskId = req.nextUrl.searchParams.get("taskId");
  if (!taskId) return NextResponse.json({ error: "taskId wajib" }, { status: 400 });
  const key = getKey(req);
  if (!key) return NextResponse.json({ error: "apiKey wajib" }, { status: 400 });
  const r = await tripoFetch(`/task/${taskId}`, key);
  if (!r.ok) return r;
  const data = await r.json();
  return NextResponse.json({
    status: data.data?.status,
    progress: data.data?.progress,
    modelUrl: data.data?.output?.pbr_model || data.data?.output?.model || null,
    taskId: data.data?.task_id,
  });
}
