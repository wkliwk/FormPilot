import { auth, signOut } from "@/lib/auth";
import { redirect } from "next/navigation";
import DashboardNav from "@/components/DashboardNav";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const handleSignOut = async () => {
    "use server";
    await signOut({ redirectTo: "/" });
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <DashboardNav
        email={session.user.email ?? undefined}
        signOutAction={handleSignOut}
      />
      {children}
    </div>
  );
}
