import { auth, signOut } from "@/lib/auth";
import { redirect } from "next/navigation";
import DashboardNav from "@/components/DashboardNav";
import EmailVerificationBanner from "@/components/EmailVerificationBanner";

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
      <div className="max-w-4xl mx-auto px-4 pt-4">
        <EmailVerificationBanner />
      </div>
      {children}
    </div>
  );
}
