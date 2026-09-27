import { SignUp } from "@clerk/nextjs";
import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";

export default function SignUpPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-[#09090b] text-neutral-900 dark:text-neutral-100 flex flex-col justify-between p-4 sm:p-6">
      <div className="flex justify-between items-center max-w-6xl w-full mx-auto">
        <Link
          href="/"
          className="text-xs font-mono text-neutral-500 hover:text-neutral-900 dark:hover:text-white transition-colors"
        >
          &larr; Back to Inventra
        </Link>
        <ThemeToggle />
      </div>

      <div className="flex flex-col items-center justify-center my-auto">
        <div className="mb-6 text-center">
          <Link
            href="/"
            className="text-base font-semibold tracking-tight text-neutral-950 dark:text-white hover:opacity-90 transition-opacity"
          >
            Inventra
          </Link>
          <p className="mt-1 text-xs text-neutral-500">
            Create an enterprise account
          </p>
        </div>
        <SignUp />
      </div>

      <div className="text-center text-[11px] font-mono text-neutral-400 dark:text-neutral-600">
        Inventra System
      </div>
    </div>
  );
}
