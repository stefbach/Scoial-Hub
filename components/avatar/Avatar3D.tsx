"use client";

/**
 * Avatar 3D humain réaliste (Ready Player Me / GLB) rendu via three.js.
 * - lip-sync : lit `mouthRef.current` (0..1) chaque frame → morph "jawOpen"/"mouthOpen"
 * - clignement périodique (morphs eyeBlink) + léger balancement/respiration
 * En cas d'échec de chargement, appelle onError (le parent retombe sur l'avatar SVG).
 */

import { useEffect, useRef } from "react";

export function Avatar3D({
  modelUrl,
  mouthRef,
  onError,
  onReady,
}: {
  modelUrl: string;
  mouthRef: React.MutableRefObject<number>;
  onError?: () => void;
  onReady?: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let disposed = false;
    let raf = 0;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let renderer: any, scene: any, camera: any;
    const cleanupFns: Array<() => void> = [];

    (async () => {
      try {
        const THREE = await import("three");
        const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");
        const el = containerRef.current;
        if (!el || disposed) return;

        const w = el.clientWidth || 320;
        const h = el.clientHeight || 360;

        scene = new THREE.Scene();
        camera = new THREE.PerspectiveCamera(26, w / h, 0.1, 100);
        camera.position.set(0, 1.6, 0.72);
        camera.lookAt(0, 1.58, 0);

        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.setSize(w, h);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (renderer as any).outputColorSpace = THREE.SRGBColorSpace;
        el.appendChild(renderer.domElement);

        // Éclairage studio (rendu flatteur).
        scene.add(new THREE.HemisphereLight(0xffffff, 0x8899aa, 1.1));
        const key = new THREE.DirectionalLight(0xffffff, 1.6);
        key.position.set(1, 2.5, 2);
        scene.add(key);
        const fill = new THREE.DirectionalLight(0xffe9d6, 0.5);
        fill.position.set(-2, 1, 1);
        scene.add(fill);

        const loader = new GLTFLoader();
        const gltf = await loader.loadAsync(modelUrl);
        if (disposed) return;

        const model = gltf.scene;
        scene.add(model);

        // Collecte des meshes à morphs (tête, dents…).
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const morphMeshes: any[] = [];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        model.traverse((o: any) => {
          if (o.isMesh && o.morphTargetDictionary && o.morphTargetInfluences) morphMeshes.push(o);
        });
        const setMorph = (name: string, value: number) => {
          for (const m of morphMeshes) {
            const idx = m.morphTargetDictionary[name];
            if (idx !== undefined) m.morphTargetInfluences[idx] = value;
          }
        };

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const head = model.getObjectByName("Head") as any;
        const baseRotY = model.rotation.y;

        onReady?.();
        const start = performance.now();
        let nextBlink = start + 2500;
        let blinkT = -1;

        const tick = () => {
          if (disposed) return;
          raf = requestAnimationFrame(tick);
          const now = performance.now();
          const tSec = (now - start) / 1000;

          // Lip-sync
          const m = Math.max(0, Math.min(1, mouthRef.current));
          setMorph("jawOpen", m * 0.7);
          setMorph("mouthOpen", m * 0.6);
          setMorph("viseme_aa", m * 0.5);

          // Clignement
          if (blinkT < 0 && now >= nextBlink) blinkT = 0;
          if (blinkT >= 0) {
            blinkT += 0.08;
            const b = blinkT < 0.5 ? blinkT * 2 : Math.max(0, 1 - (blinkT - 0.5) * 2);
            setMorph("eyeBlinkLeft", b);
            setMorph("eyeBlinkRight", b);
            if (blinkT >= 1) { blinkT = -1; nextBlink = now + 2200 + Math.random() * 2600; }
          }

          // Respiration / balancement léger
          model.rotation.y = baseRotY + Math.sin(tSec * 0.6) * 0.05;
          if (head) head.rotation.x = Math.sin(tSec * 0.9) * 0.02;

          renderer.render(scene, camera);
        };
        tick();

        const onResize = () => {
          if (!containerRef.current) return;
          const nw = containerRef.current.clientWidth, nh = containerRef.current.clientHeight;
          camera.aspect = nw / nh; camera.updateProjectionMatrix(); renderer.setSize(nw, nh);
        };
        window.addEventListener("resize", onResize);
        cleanupFns.push(() => window.removeEventListener("resize", onResize));
      } catch (err) {
        console.warn("[Avatar3D] load failed:", err);
        onError?.();
      }
    })();

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      cleanupFns.forEach((f) => f());
      try {
        renderer?.dispose?.();
        if (renderer?.domElement?.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
      } catch {
        /* noop */
      }
    };
  }, [modelUrl, mouthRef, onError, onReady]);

  return <div ref={containerRef} className="h-full w-full" />;
}
