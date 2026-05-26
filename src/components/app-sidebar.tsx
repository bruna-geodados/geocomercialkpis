import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, TrendingUp, CalendarClock, MapPin, Layers } from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader,
} from "@/components/ui/sidebar";

const items = [
  { title: "Visão Geral", url: "/", icon: LayoutDashboard },
  { title: "Receita por Serviço", url: "/receita", icon: TrendingUp },
  { title: "Contratos & Vigências", url: "/vigencias", icon: CalendarClock },
  { title: "Municípios", url: "/municipios", icon: MapPin },
  { title: "SIG & Licenças", url: "/sig", icon: Layers },
];

export function AppSidebar() {
  const path = useRouterState({ select: (r) => r.location.pathname });
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="px-4 py-5 border-b border-sidebar-border">
        <div className="flex flex-col">
          <span className="text-[10px] uppercase tracking-[0.2em] text-sidebar-foreground/60">
            Dashboard
          </span>
          <span className="text-base font-semibold text-sidebar-foreground">
            Comercial
          </span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Análise</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={path === item.url}>
                    <Link to={item.url} className="flex items-center gap-2">
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}