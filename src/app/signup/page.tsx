import { SignupForm } from "./signup-form";

export default function SignupPage() {
  return (
    <div className="flex min-h-full flex-1 items-center justify-center bg-gray-50 px-4 py-12">
      <div className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-semibold text-gray-900">Social Hub</h1>
          <p className="mt-1 text-sm text-gray-500">
            Create your account — you&apos;ll join the{" "}
            <span className="font-medium text-gray-700">DDS Group</span>{" "}
            workspace.
          </p>
        </div>
        <SignupForm />
      </div>
    </div>
  );
}
