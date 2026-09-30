import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { Sidebar } from "@/components/layout/sidebar";
import { CommandPalette } from "@/components/layout/command-palette";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  return (
    <div className="min-h-dvh bg-canvas">
      <Sidebar user={user} />
      <div className="lg:pl-[272px]">
        {/* Global header bar with command palette */}
        <div className="sticky top-0 z-20 hidden h-14 items-center justify-end gap-3 border-b border-hairline bg-white/80 px-6 backdrop-blur-md lg:flex">
          <CommandPalette />
        </div>
        <main className="mx-auto w-full max-w-[1400px] px-4 pt-6 pb-20 sm:px-6 lg:px-8 lg:pt-8">
          {children}
        </main>
      </div>
    </div>
  );
}
