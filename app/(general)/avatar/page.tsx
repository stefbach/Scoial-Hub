"use client";

import { useCompany } from "@/lib/company-context";
import { useT } from "@/lib/i18n";
import { AvatarChat } from "@/components/avatar/AvatarChat";

export default function AvatarPage() {
  const { company } = useCompany();
  const t = useT();
  return (
    <div className="mx-auto max-w-5xl p-4">
      <h1 className="mb-1 text-lg font-semibold text-ink">
        🧑‍🚀 {t("Avatar IA", "AI Avatar")}
      </h1>
      <p className="mb-4 text-sm text-muted">
        {t(
          "Un assistant de marque qui parle et écoute, propulsé par Claude et la mémoire de votre Hub.",
          "A talking, listening brand assistant, powered by Claude and your Hub's memory.",
        )}
      </p>
      <AvatarChat companyId={company.id} />
    </div>
  );
}
