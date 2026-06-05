/**
 * Chargement de ffmpeg.wasm (core single-thread, depuis le CDN) + utilitaires
 * de montage côté navigateur. Aucun header COOP/COEP requis.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let ffmpegPromise: Promise<any> | null = null;

/** Charge (une seule fois) une instance ffmpeg.wasm prête à l'emploi. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getFfmpeg(): Promise<any> {
  if (ffmpegPromise) return ffmpegPromise;
  ffmpegPromise = (async () => {
    const { FFmpeg } = await import("@ffmpeg/ffmpeg");
    const { toBlobURL } = await import("@ffmpeg/util");
    const ff = new FFmpeg();
    const base = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd";
    await ff.load({
      coreURL: await toBlobURL(`${base}/ffmpeg-core.js`, "text/javascript"),
      wasmURL: await toBlobURL(`${base}/ffmpeg-core.wasm`, "application/wasm"),
    });
    return ff;
  })();
  return ffmpegPromise;
}

/**
 * Concatène plusieurs clips (URLs distantes mp4) en une seule vidéo, sans
 * ré-encodage (demuxer `concat` + copie de flux). Les clips Veo 3 partagent le
 * même codec/résolution, donc la copie fonctionne et reste rapide.
 */
export async function concatVideos(urls: string[]): Promise<Blob> {
  if (urls.length === 1) {
    const res = await fetch(urls[0]);
    return res.blob();
  }
  const ff = await getFfmpeg();
  const { fetchFile } = await import("@ffmpeg/util");

  const names: string[] = [];
  for (let i = 0; i < urls.length; i++) {
    const name = `c${i}.mp4`;
    await ff.writeFile(name, await fetchFile(urls[i]));
    names.push(name);
  }
  const list = names.map((n) => `file '${n}'`).join("\n");
  await ff.writeFile("list.txt", new TextEncoder().encode(list));

  await ff.exec(["-f", "concat", "-safe", "0", "-i", "list.txt", "-c", "copy", "out.mp4"]);
  const data = (await ff.readFile("out.mp4")) as Uint8Array;
  // Copie dans un ArrayBuffer "classique" (la sortie peut être SharedArrayBuffer).
  const bytes = new Uint8Array(data.length);
  bytes.set(data);
  return new Blob([bytes], { type: "video/mp4" });
}
