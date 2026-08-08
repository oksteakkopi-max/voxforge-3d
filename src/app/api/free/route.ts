import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Free mode: proxy image-to-3D to user's Colab TripoSR Gradio space.
// Expects header `x-colab-url` (the https://xxxx.gradio.live from Colab).
export async function POST(req: NextRequest) {
  const colab = req.headers.get("x-colab-url");
  if (!colab) {
    return NextResponse.json(
      { error: "Set Colab URL dulu di Settings (jalankan colab_triosr.ipynb)" },
      { status: 400 }
    );
  }
  const { imageDataUrl } = await req.json().catch(() => ({}) as any);
  if (!imageDataUrl) return NextResponse.json({ error: "image wajib" }, { status: 400 });

  const base64 = imageDataUrl.split(",")[1];
  const payload = {
    data: [`data:image/png;base64,${base64}`],
  };

  try {
    const r = await fetch(`${colab.replace(/\/$/, "")}/api/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const j = await r.json();
    // Gradio returns { data: [ "/tmp/xxx.glb" ] } or url
    const path = j?.data?.[0];
    if (!path) return NextResponse.json({ error: "Colab tidak mengembalikan model" }, { status: 502 });
    // path is a local file path on colab; fetch via /file= endpoint
    const fileUrl = `${colab.replace(/\/$/, "")}/file=${path}`;
    const glb = await fetch(fileUrl);
    const buf = await glb.arrayBuffer();
    return new NextResponse(buf, { headers: { "Content-Type": "model/gltf-binary" } });
  } catch (e: any) {
    return NextResponse.json({ error: "Colab error: " + e.message }, { status: 502 });
  }
}
