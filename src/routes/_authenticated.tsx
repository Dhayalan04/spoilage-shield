import { createFileRoute, Link, Outlet, redirect, useNavigate, useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Leaf, LayoutDashboard, Warehouse, LineChart, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      throw redirect({ to: "/login" });
    }
    return { user: data.user };
  },
  component: AuthLayout,
});

function AuthLayout() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const signOut = async () => {
    await supabase.auth.signOut();
    toast.success("Signed out");
    navigate({ to: "/", replace: true });
  };

  const navItems = [
    { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { to: "/units", label: "Storage Units", icon: Warehouse },
    { to: "/market", label: "Market Prices", icon: LineChart },
  ];

  return (
    <div className="flex min-h-screen bg-muted/30">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex">
        <div className="flex items-center gap-2 px-6 py-5 font-heading text-lg font-bold">
          <Leaf className="h-5 w-5 text-primary-glow" /> CropSense
        </div>
        <nav className="flex-1 space-y-1 px-3">
          {navItems.map((it) => {
            const active = pathname === it.to || pathname.startsWith(it.to + "/");
            return (
              <Link key={it.to} to={it.to}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
                  active ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50"
                }`}>
                <it.icon className="h-4 w-4" /> {it.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-sidebar-border p-3">
          <div className="mb-2 px-2 text-xs text-sidebar-foreground/60 truncate">{user.email}</div>
          <Button onClick={signOut} variant="ghost" size="sm" className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
            <LogOut className="mr-2 h-4 w-4" /> Sign out
          </Button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 inset-x-0 z-20 flex items-center justify-between border-b border-border bg-background px-4 py-3">
        <Link to="/dashboard" className="flex items-center gap-2 font-heading font-bold text-primary">
          <Leaf className="h-5 w-5" /> CropSense
        </Link>
        <div className="flex gap-1">
          {navItems.map((it) => (
            <Link key={it.to} to={it.to} className="rounded-md p-2 text-muted-foreground hover:bg-muted">
              <it.icon className="h-4 w-4" />
            </Link>
          ))}
          <button onClick={signOut} className="rounded-md p-2 text-muted-foreground hover:bg-muted">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>

      <main className="flex-1 overflow-x-hidden pt-16 md:pt-0">
        <Outlet />
      </main>
    </div>
  );
}
