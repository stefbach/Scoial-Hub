/**
 * lib/connectors/meta-publish.ts
 *
 * Primitives de PUBLICATION ORGANIQUE Meta — implémentation UNIQUE partagée par
 * la route directe (/api/meta/publish) et le connecteur de programmation
 * (lib/connectors/meta.ts). Couvre les trois emplacements réels :
 *
 *   • feed  — publication classique (texte / photo / vidéo)
 *   • story — Story éphémère 24 h (photo ou vidéo)
 *   • reel  — Reel (vidéo verticale)
 *
 * Chaque emplacement a son propre endpoint Graph : une Story n'est PAS un post
 * de fil publié ailleurs, c'est `/{page-id}/photo_stories` (photo, en 2 temps)
 * ou `/{page-id}/video_stories` (vidéo, en 3 temps) côté Facebook, et
 * `media_type=STORIES` côté Instagram. C'est la raison pour laquelle publier
 * une story était impossible : ces endpoints n'étaient appelés nulle part.
 *
 * Doc : https://developers.facebook.com/docs/page-stories-api
 *       https://developers.facebook.com/docs/instagram-platform/content-publishing
 */

import { signFormBody, withAppSecretProof } from "@/lib/connectors/meta-appsecret";

const V = process.env.META_API_VERSION ?? "v21.0";
const GRAPH = `https://graph.facebook.com/${V}`;

/** Emplacement de publication demandé. */
export type MetaPostType = "feed" | "story" | "reel";
/** Nature du média joint. */
export type MetaMediaKind = "image" | "video";

export interface MetaPublishInput {
  text?: string;
  mediaUrl?: string;
  /** Déduit de l'URL / du mime si absent. */
  mediaKind?: MetaMediaKind;
  postType?: MetaPostType;
  /**
   * Conteneur Instagram déjà créé lors d'une tentative précédente, à REPRENDRE
   * au lieu d'en fabriquer un nouveau. Instagram garde un conteneur valide 24 h :
   * sans cette reprise, chaque réessai repartait de zéro et butait sur la même
   * attente, indéfiniment.
   */
  igContainerId?: string;
}

export interface MetaPublishOutcome {
  ok: boolean;
  /** Identifiant du post créé côté Meta (post_id quand Meta le fournit). */
  id?: string;
  url?: string;
  error?: string;
  /**
   * Code d'erreur Meta. Remonté tel quel pour que l'appelant distingue les
   * pannes transitoires du token invalide (code 190) — qui doit couper la
   * connexion au lieu d'être réessayé indéfiniment par le cron.
   */
  code?: number;
  /**
   * Conteneur Instagram créé mais pas encore prêt. À conserver par l'appelant
   * pour reprendre la publication au prochain essai plutôt que d'en créer un
   * nouveau (et de repayer l'attente depuis le début).
   */
  pendingContainerId?: string;
}

/** Code Graph « Invalid OAuth 2.0 Access Token » : seule une reconnexion aide. */
export const META_INVALID_TOKEN_CODE = 190;

const VIDEO_EXT = /\.(mp4|mov|m4v|webm|avi|mkv)(\?|$)/i;

/** Nature du média : mime explicite prioritaire, sinon extension de l'URL. */
export function inferMediaKind(url: string, mimeType?: string): MetaMediaKind {
  if (mimeType?.startsWith("video")) return "video";
  if (mimeType?.startsWith("image")) return "image";
  return VIDEO_EXT.test(url) ? "video" : "image";
}

/** Normalise un `postType` reçu du client (valeur inconnue → "feed"). */
export function normalizePostType(value: unknown): MetaPostType {
  return value === "story" || value === "reel" ? value : "feed";
}

/** Libellé lisible d'un emplacement (messages d'erreur). */
export function postTypeLabel(type: MetaPostType): string {
  return type === "story" ? "Story" : type === "reel" ? "Reel" : "Publication";
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

type GraphJson = Record<string, unknown> & { error?: { message?: string; code?: number } };

async function graphPost(path: string, params: Record<string, string>): Promise<GraphJson> {
  const res = await fetch(`${GRAPH}/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: signFormBody(new URLSearchParams(params)).toString(),
    cache: "no-store",
  });
  return (await res.json().catch(() => ({}))) as GraphJson;
}

async function graphGet(path: string, fields: string, token: string): Promise<GraphJson> {
  const sep = path.includes("?") ? "&" : "?";
  const res = await fetch(
    withAppSecretProof(`${GRAPH}/${path}${sep}fields=${encodeURIComponent(fields)}&access_token=${encodeURIComponent(token)}`),
    { cache: "no-store" }
  );
  return (await res.json().catch(() => ({}))) as GraphJson;
}

/** Échec normalisé à partir d'une réponse Graph (message + code Meta). */
function fail(json: GraphJson, fallback: string): MetaPublishOutcome {
  return { ok: false, error: json.error?.message ?? fallback, code: json.error?.code };
}

// ── Facebook ─────────────────────────────────────────────────────────────────

/**
 * Téléverse une vidéo hébergée dans un conteneur Story/Reel de Page.
 * Flux imposé par Meta : start (réserve un video_id + une URL rupload) →
 * upload (Meta va chercher le fichier via l'en-tête `file_url`) → finish.
 */
async function uploadPageVideoContainer(
  pageId: string,
  pageToken: string,
  edge: "video_stories" | "video_reels",
  fileUrl: string,
  description?: string
): Promise<MetaPublishOutcome> {
  const start = await graphPost(`${pageId}/${edge}`, { upload_phase: "start", access_token: pageToken });
  if (start.error || !start.video_id) {
    return fail(start, "Meta a refusé l'initialisation de la vidéo.");
  }
  const videoId = String(start.video_id);
  const uploadUrl = typeof start.upload_url === "string" ? start.upload_url : "";
  if (!uploadUrl) return { ok: false, error: "Meta n'a pas renvoyé d'URL de téléversement." };

  // Téléversement « hosted file » : Meta télécharge lui-même l'URL publique.
  const up = await fetch(uploadUrl, {
    method: "POST",
    headers: { Authorization: `OAuth ${pageToken}`, file_url: fileUrl },
  });
  const upJson = (await up.json().catch(() => ({}))) as GraphJson;
  if (!up.ok || upJson.error) {
    return fail(upJson, "Meta n'a pas pu récupérer la vidéo. Vérifiez que son URL est publique et au format MP4.");
  }

  // La vidéo est transcodée de façon asynchrone : publier trop tôt échoue.
  const notReady = await waitForPageVideoReady(videoId, pageToken);
  if (notReady) return { ok: false, error: notReady };

  const finish = await graphPost(`${pageId}/${edge}`, {
    upload_phase: "finish",
    video_id: videoId,
    video_state: "PUBLISHED",
    ...(description ? { description } : {}),
    access_token: pageToken,
  });
  if (finish.error) return fail(finish, "Meta a refusé la publication de la vidéo.");

  const postId = typeof finish.post_id === "string" ? finish.post_id : videoId;
  return { ok: true, id: postId, url: `https://www.facebook.com/${postId}` };
}

/** Attend la fin du transcodage d'une vidéo de Page. Renvoie une erreur, ou null. */
async function waitForPageVideoReady(videoId: string, pageToken: string): Promise<string | null> {
  const deadline = Date.now() + 40_000;
  let delay = 1500;
  while (Date.now() < deadline) {
    const s = await graphGet(videoId, "status", pageToken);
    const status = (s.status ?? {}) as { video_status?: string; processing_phase?: { status?: string } };
    const v = status.video_status ?? status.processing_phase?.status ?? "";
    if (v === "ready" || v === "complete") return null;
    if (v === "error") return "Meta n'a pas pu traiter la vidéo (format ou durée non supportés).";
    await sleep(delay);
    delay = Math.min(Math.round(delay * 1.5), 5000);
  }
  // Pas d'échec dur : Meta finit souvent le traitement juste après.
  return null;
}

/** Publie sur une Page Facebook (fil, story ou reel). */
export async function publishToFacebookPage(
  pageId: string,
  pageToken: string,
  input: MetaPublishInput
): Promise<MetaPublishOutcome> {
  const postType = input.postType ?? "feed";
  const text = input.text?.trim() ?? "";
  const mediaUrl = input.mediaUrl?.trim();
  const kind = mediaUrl ? input.mediaKind ?? inferMediaKind(mediaUrl) : undefined;

  if (postType !== "feed" && !mediaUrl) {
    return { ok: false, error: `Une ${postTypeLabel(postType)} Facebook exige un média (image ou vidéo).` };
  }
  if (postType === "reel" && kind !== "video") {
    return { ok: false, error: "Un Reel Facebook exige une vidéo verticale (9:16)." };
  }

  // ── Story ──────────────────────────────────────────────────────────────────
  if (postType === "story") {
    if (kind === "video") return uploadPageVideoContainer(pageId, pageToken, "video_stories", mediaUrl!);

    // Photo : la photo est d'abord téléversée NON publiée, puis promue en story.
    const photo = await graphPost(`${pageId}/photos`, { url: mediaUrl!, published: "false", access_token: pageToken });
    if (photo.error || !photo.id) {
      return fail(photo, "Meta a refusé l'image de la story.");
    }
    const story = await graphPost(`${pageId}/photo_stories`, { photo_id: String(photo.id), access_token: pageToken });
    if (story.error) return fail(story, "Meta a refusé la publication de la story.");
    const id = typeof story.post_id === "string" ? story.post_id : String(photo.id);
    return { ok: true, id, url: `https://www.facebook.com/${id}` };
  }

  // ── Reel ───────────────────────────────────────────────────────────────────
  if (postType === "reel") {
    return uploadPageVideoContainer(pageId, pageToken, "video_reels", mediaUrl!, text);
  }

  // ── Fil (feed) ─────────────────────────────────────────────────────────────
  if (mediaUrl && kind === "video") {
    const vid = await graphPost(`${pageId}/videos`, { file_url: mediaUrl, description: text, access_token: pageToken });
    if (vid.error || !vid.id) return fail(vid, "Meta a refusé la vidéo.");
    return { ok: true, id: String(vid.id), url: `https://www.facebook.com/${vid.id}` };
  }
  if (mediaUrl) {
    const photo = await graphPost(`${pageId}/photos`, { url: mediaUrl, caption: text, access_token: pageToken });
    if (photo.error) return fail(photo, "Meta a refusé l'image.");
    const id = String(photo.post_id ?? photo.id ?? "");
    return { ok: true, id, url: id ? `https://www.facebook.com/${id}` : undefined };
  }
  const post = await graphPost(`${pageId}/feed`, { message: text, access_token: pageToken });
  if (post.error || !post.id) return fail(post, "Meta a refusé la publication.");
  return { ok: true, id: String(post.id), url: `https://www.facebook.com/${post.id}` };
}

/**
 * Publie un album (plusieurs photos) sur le fil d'une Page Facebook.
 * Chaque image est d'abord téléversée NON publiée (`published=false`), puis
 * le post au fil les rattache toutes via `attached_media` — c'est le seul
 * moyen Graph d'obtenir plusieurs photos dans UN SEUL post plutôt qu'un post
 * par image.
 */
export async function publishFacebookAlbum(
  pageId: string,
  pageToken: string,
  imageUrls: string[],
  text: string
): Promise<MetaPublishOutcome> {
  const mediaIds: string[] = [];
  for (const url of imageUrls) {
    const photo = await graphPost(`${pageId}/photos`, { url, published: "false", access_token: pageToken });
    if (photo.error || !photo.id) return fail(photo, "Meta a refusé une image de l'album.");
    mediaIds.push(String(photo.id));
  }
  const post = await graphPost(`${pageId}/feed`, {
    message: text,
    attached_media: JSON.stringify(mediaIds.map((id) => ({ media_fbid: id }))),
    access_token: pageToken,
  });
  if (post.error || !post.id) return fail(post, "Meta a refusé la publication de l'album.");
  return { ok: true, id: String(post.id), url: `https://www.facebook.com/${post.id}` };
}

// ── Instagram ────────────────────────────────────────────────────────────────

/**
 * Attend qu'un conteneur média Instagram soit prêt (`status_code = FINISHED`)
 * avant `media_publish` : sans cette attente Instagram renvoie « [9007] Media
 * ID is not available », le média étant traité de façon asynchrone.
 * Renvoie un message d'erreur, ou null si le conteneur est prêt.
 */
export async function waitForIgContainerReady(containerId: string, token: string): Promise<string | null> {
  // Budget d'attente, réglable : il doit rester SOUS la durée max de la
  // fonction serverless. Abaissé dans les tests pour ne pas les figer 45 s.
  const budget = Number(process.env.IG_CONTAINER_WAIT_MS) || 45_000;
  const deadline = Date.now() + budget;
  let delay = 1200;
  while (Date.now() < deadline) {
    const s = await graphGet(containerId, "status_code,status", token);
    if (s.error) return s.error.message ?? "Statut du conteneur indisponible.";
    if (s.status_code === "FINISHED") return null;
    if (s.status_code === "ERROR" || s.status_code === "EXPIRED") {
      return `Instagram n'a pas pu préparer le média (${String(s.status_code)}). Vérifiez que le média est public et au bon format.`;
    }
    await sleep(delay);
    delay = Math.min(Math.round(delay * 1.5), 5000);
  }
  return "Instagram met trop de temps à préparer le média (délai dépassé). Réessayez dans un instant.";
}

/** Publie sur un compte Instagram Business (fil, story ou reel). */
export async function publishToInstagram(
  igId: string,
  token: string,
  input: MetaPublishInput
): Promise<MetaPublishOutcome> {
  const postType = input.postType ?? "feed";
  const text = input.text?.trim() ?? "";
  const mediaUrl = input.mediaUrl?.trim();
  if (!mediaUrl) {
    return { ok: false, error: `Instagram exige un média (image ou vidéo) pour une ${postTypeLabel(postType)}.` };
  }
  const kind = input.mediaKind ?? inferMediaKind(mediaUrl);
  if (postType === "reel" && kind !== "video") {
    return { ok: false, error: "Un Reel Instagram exige une vidéo verticale (9:16)." };
  }

  const params: Record<string, string> = { access_token: token };
  if (postType === "story") {
    // Une story ne porte pas de légende : Meta ignore/refuse `caption` ici.
    params.media_type = "STORIES";
    params[kind === "video" ? "video_url" : "image_url"] = mediaUrl;
  } else if (kind === "video") {
    // Toute vidéo publiée au fil devient un Reel côté Instagram : `media_type=VIDEO`
    // est retiré de l'API — envoyer REELS est le seul chemin qui aboutit.
    params.media_type = "REELS";
    params.video_url = mediaUrl;
    params.caption = text;
  } else {
    params.image_url = mediaUrl;
    params.caption = text;
  }

  // Reprise d'un conteneur déjà créé (réessai) : on ne repaie pas la création
  // ni l'attente initiale, on vérifie simplement s'il est prêt maintenant.
  let containerId = input.igContainerId?.trim();
  if (!containerId) {
    const container = await graphPost(`${igId}/media`, params);
    if (container.error || !container.id) {
      return fail(container, "Instagram a refusé le conteneur média.");
    }
    containerId = String(container.id);
  }

  const notReady = await waitForIgContainerReady(containerId, token);

  // Le conteneur n'est pas annoncé prêt. Deux cas très différents :
  //   • délai dépassé — Instagram finit souvent le traitement juste après. On
  //     TENTE quand même la publication ; si elle passe, l'attente n'était
  //     qu'un excès de prudence. Sinon on rend le conteneur à l'appelant pour
  //     qu'il reprenne au prochain essai.
  //   • média refusé (ERROR/EXPIRED) — inutile d'insister.
  const timedOut = Boolean(notReady) && /délai dépassé/i.test(notReady!);
  if (notReady && !timedOut) return { ok: false, error: notReady };

  const pub = await graphPost(`${igId}/media_publish`, { creation_id: containerId, access_token: token });
  if (pub.error || !pub.id) {
    const failed = fail(pub, "Instagram a refusé la publication.");
    // Encore en préparation : la prochaine tentative reprendra CE conteneur.
    return timedOut ? { ...failed, error: notReady!, pendingContainerId: containerId } : failed;
  }
  return { ok: true, id: String(pub.id) };
}

/**
 * Publie un carrousel (2 à 10 images) sur le fil d'un compte Instagram
 * Business. Chaque image devient un conteneur enfant (`is_carousel_item`),
 * puis un conteneur parent (`media_type=CAROUSEL`) les regroupe avant
 * publication — Instagram n'a pas d'équivalent au `attached_media` de
 * Facebook, la hiérarchie enfant/parent est obligatoire.
 */
export async function publishInstagramCarousel(
  igId: string,
  token: string,
  imageUrls: string[],
  text: string
): Promise<MetaPublishOutcome> {
  const childIds: string[] = [];
  for (const url of imageUrls) {
    const child = await graphPost(`${igId}/media`, {
      image_url: url,
      is_carousel_item: "true",
      access_token: token,
    });
    if (child.error || !child.id) return fail(child, "Instagram a refusé une image du carrousel.");
    childIds.push(String(child.id));
  }
  for (const id of childIds) {
    const notReady = await waitForIgContainerReady(id, token);
    if (notReady) return { ok: false, error: notReady };
  }

  const parent = await graphPost(`${igId}/media`, {
    media_type: "CAROUSEL",
    children: childIds.join(","),
    caption: text,
    access_token: token,
  });
  if (parent.error || !parent.id) return fail(parent, "Instagram a refusé le carrousel.");
  const parentId = String(parent.id);

  const parentNotReady = await waitForIgContainerReady(parentId, token);
  if (parentNotReady) return { ok: false, error: parentNotReady };

  const pub = await graphPost(`${igId}/media_publish`, { creation_id: parentId, access_token: token });
  if (pub.error || !pub.id) return fail(pub, "Instagram a refusé la publication du carrousel.");
  return { ok: true, id: String(pub.id) };
}
