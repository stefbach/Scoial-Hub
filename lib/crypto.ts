// Chiffrement des secrets au repos (AES-256-GCM, Node `crypto`).
//
// Variables d'env :
//   TOKEN_ENCRYPTION_KEY — phrase secrète (n'importe quelle longueur) utilisée
//     pour dériver une clé 32 octets via scrypt. Si absente → no-op (les valeurs
//     sont stockées/lues telles quelles) pour ne rien casser en dev/démo.
//
// Format de sortie : "enc:v1:<base64(salt|iv|tag|ciphertext)>".
//   - salt : 16 octets (dérivation scrypt par valeur)
//   - iv   : 12 octets (nonce GCM)
//   - tag  : 16 octets (tag d'authentification GCM)
//
// Compat ascendante : decryptSecret() renvoie telle quelle toute valeur qui ne
// commence PAS par "enc:" (tokens en clair existants continuent de marcher).

import crypto from "crypto";

const PREFIX = "enc:v1:";
const ENC_MARKER = "enc:";
const SALT_LEN = 16;
const IV_LEN = 12;
const TAG_LEN = 16;
const KEY_LEN = 32;

function getMasterKey(): string | null {
  const k = process.env.TOKEN_ENCRYPTION_KEY;
  return k && k.length > 0 ? k : null;
}

function deriveKey(masterKey: string, salt: Buffer): Buffer {
  return crypto.scryptSync(masterKey, salt, KEY_LEN);
}

/**
 * Chiffre une valeur sensible. Si aucune clé d'env n'est configurée, renvoie la
 * valeur telle quelle (no-op). Ne throw pas sur entrée vide.
 */
export function encryptSecret(plain: string): string {
  if (plain === undefined || plain === null || plain === "") return plain;
  // Déjà chiffré → ne pas re-chiffrer (idempotent).
  if (typeof plain === "string" && plain.startsWith(ENC_MARKER)) return plain;

  const masterKey = getMasterKey();
  if (!masterKey) return plain; // no-op : compat dev/démo

  try {
    const salt = crypto.randomBytes(SALT_LEN);
    const iv = crypto.randomBytes(IV_LEN);
    const key = deriveKey(masterKey, salt);
    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
    const ciphertext = Buffer.concat([cipher.update(String(plain), "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    const packed = Buffer.concat([salt, iv, tag, ciphertext]).toString("base64");
    return PREFIX + packed;
  } catch (err) {
    // Ne jamais casser le chemin critique : en cas d'échec, on stocke en clair
    // (mieux vaut une donnée utilisable qu'une exception en prod).
    console.error("[crypto] encryptSecret a échoué, stockage en clair:", err);
    return plain;
  }
}

/**
 * Déchiffre une valeur. Si la valeur n'a pas le préfixe "enc:" → renvoyée telle
 * quelle (compat tokens en clair). Si pas de clé d'env → renvoyée telle quelle.
 */
export function decryptSecret(enc: string): string {
  if (enc === undefined || enc === null || enc === "") return enc;
  if (typeof enc !== "string" || !enc.startsWith(ENC_MARKER)) return enc; // clair → no-op

  // Préfixe connu uniquement : "enc:v1:". Tout autre marqueur enc: inconnu →
  // renvoyé tel quel (évite de jeter une exception sur un format futur).
  if (!enc.startsWith(PREFIX)) return enc;

  const masterKey = getMasterKey();
  if (!masterKey) return enc; // no-op : pas de clé → on ne peut pas déchiffrer

  try {
    const packed = Buffer.from(enc.slice(PREFIX.length), "base64");
    const salt = packed.subarray(0, SALT_LEN);
    const iv = packed.subarray(SALT_LEN, SALT_LEN + IV_LEN);
    const tag = packed.subarray(SALT_LEN + IV_LEN, SALT_LEN + IV_LEN + TAG_LEN);
    const ciphertext = packed.subarray(SALT_LEN + IV_LEN + TAG_LEN);
    const key = deriveKey(masterKey, salt);
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    const plain = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return plain.toString("utf8");
  } catch (err) {
    // En cas d'échec (mauvaise clé, donnée corrompue) on renvoie la valeur brute
    // plutôt que de throw sur le chemin critique.
    console.error("[crypto] decryptSecret a échoué:", err);
    return enc;
  }
}
