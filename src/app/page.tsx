import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signout } from "@/app/auth/actions";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Ensure the user has a public.users profile row (idempotent). Needed because
  // Supabase Auth creates auth.users but not the matching app profile.
  await supabase.rpc("bootstrap_user_profile");

  const { data: profile } = await supabase
    .from("users")
    .select("full_name, email, role, org_id, organizations(name)")
    .eq("id", user.id)
    .single();

  const { data: companies } = await supabase
    .from("companies")
    .select("id, name")
    .order("name");

  const orgName =
    (profile?.organizations as { name?: string } | null)?.name ?? "—";

  return (
    <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col gap-8 px-6 py-12">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Social Hub</h1>
          <p className="text-sm text-gray-500">{orgName}</p>
        </div>
        <form action={signout}>
          <button
            type="submit"
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
          >
            Sign out
          </button>
        </form>
      </header>

      <section className="rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="text-sm font-medium text-gray-500">Signed in as</h2>
        <p className="mt-1 text-lg text-gray-900">
          {profile?.full_name || user.email}
        </p>
        <p className="text-sm text-gray-500">
          {profile?.email} · role: {profile?.role ?? "—"}
        </p>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="mb-3 text-sm font-medium text-gray-500">Companies</h2>
        {companies && companies.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {companies.map((c) => (
              <li
                key={c.id}
                className="rounded-md bg-gray-50 px-3 py-2 text-gray-900"
              >
                {c.name}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-500">No companies visible yet.</p>
        )}
      </section>
    </div>
  );
}
