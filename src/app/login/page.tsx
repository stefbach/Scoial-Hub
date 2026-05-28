import { LoginForm } from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ check_email?: string }>;
}) {
  const { check_email } = await searchParams;

  return (
    <div className="flex min-h-full flex-1 items-center justify-center bg-gray-50 px-4 py-12">
      <div className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-semibold text-gray-900">Social Hub</h1>
          <p className="mt-1 text-sm text-gray-500">Sign in to your account</p>
        </div>
        <LoginForm checkEmail={check_email === "1"} />
      </div>
    </div>
  );
}
