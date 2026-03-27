import { auth, signOut } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="bg-white border-b border-slate-200 px-4 sm:px-6 py-4 flex items-center justify-between">
        <Link href="/dashboard" className="text-xl font-bold text-slate-900">
          Form<span className="text-blue-600">Pilot</span>
        </Link>
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard/profile"
            className="text-sm text-slate-600 hover:text-slate-900"
          >
            My Profile
          </Link>
          <span className="text-sm text-slate-400 hidden sm:block">
            {session.user.email}
          </span>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/" });
            }}
          >
            <button
              type="submit"
              className="text-sm text-slate-400 hover:text-red-600 transition-colors"
            >
              Sign Out
            </button>
          </form>
        </div>
      </nav>
      {children}
    </div>
  );
}
