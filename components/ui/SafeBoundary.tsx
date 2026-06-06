"use client";

// Petite frontière d'erreur (error boundary) réutilisable : isole un sous-arbre
// pour qu'une erreur de rendu n'efface pas toute la page (« écran bleu »).
// Affiche un repli discret et logge l'erreur en console.

import React from "react";

interface Props {
  children: React.ReactNode;
  /** Repli affiché en cas d'erreur (sinon message générique). */
  fallback?: React.ReactNode;
  /** Étiquette pour le log console. */
  label?: string;
}
interface State {
  hasError: boolean;
  message?: string;
}

export class SafeBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError(err: unknown): State {
    return { hasError: true, message: err instanceof Error ? err.message : String(err) };
  }
  componentDidCatch(err: unknown) {
    console.error(`[SafeBoundary${this.props.label ? " " + this.props.label : ""}]`, err);
  }
  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="rounded-lg border border-warning-200 bg-warning-50 px-3 py-2 text-2xs text-warning-700">
            Affichage indisponible{this.state.message ? ` : ${this.state.message}` : ""}.
          </div>
        )
      );
    }
    return this.props.children;
  }
}

export default SafeBoundary;
