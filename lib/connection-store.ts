/**
 * lib/connection-store.ts — DÉPRÉCIÉ
 *
 * Ce module fournissait un store de connexion « Meta » basé sur des données
 * mock locales (`COMPANY_DATA`), qui constituait une 2ᵉ/3ᵉ source de vérité
 * pour le statut « connecté » et entrait en conflit avec le statut réel.
 *
 * Le statut « connecté » provient désormais UNIQUEMENT de
 * `GET /api/connectors?companyId=` (branché sur `sh_channel_connections`).
 *
 * Les helpers mock (`getMeta` / `setMeta` / `disconnectMeta`) et la fusion
 * `mergeConnectorStatus` ont été retirés. Ne pas réintroduire de source mock
 * ici : dériver le statut depuis l'API.
 */

export {};
