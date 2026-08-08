"use client";

import { Canvas } from "@react-three/fiber";
import { OrbitControls, Environment, useGLTF, Center, useAnimations } from "@react-three/drei";
import { Suspense, useEffect, useRef } from "react";

function Model({ url, animName }: { url: string; animName?: string }) {
  const { scene, animations } = useGLTF(url);
  const { actions, names } = useAnimations(animations, useRef(scene));
  useEffect(() => {
    if (animations.length === 0) return;
    const name = animName && names.includes(animName) ? animName : names[0];
    actions[name]?.reset().fadeIn(0.3).play();
    return () => { actions[name]?.fadeOut(0.3); };
  }, [actions, names, animName, animations]);

  return (
    <Center>
      <primitive object={scene} />
    </Center>
  );
}

export default function Viewer3D({ modelUrl, animName }: { modelUrl: string; animName?: string }) {
  return (
    <div className="h-[60vh] w-full rounded-2xl bg-gradient-to-br from-slate-900 to-slate-700">
      <Canvas camera={{ position: [0, 0.5, 2.5], fov: 50 }}>
        <ambientLight intensity={0.6} />
        <directionalLight position={[3, 3, 3]} intensity={1.2} />
        <Suspense fallback={null}>
          <Model url={modelUrl} animName={animName} />
          <Environment preset="city" />
        </Suspense>
        <OrbitControls enablePan={false} autoRotate />
      </Canvas>
    </div>
  );
}
