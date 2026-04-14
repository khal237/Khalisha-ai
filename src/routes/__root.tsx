import { Outlet, Link, createRootRoute, HeadContent, Scripts, useLocation } from "@tanstack/react-router";
import { Mic, BookOpen, Settings } from 'lucide-react';

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page introuvable</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          La page que vous cherchez n'existe pas.
        </p>
        <div className="mt-6">
          <Link to="/" className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90">
            Accueil
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: "Khalisha — Assistante vocale Bamoun" },
      { name: "description", content: "Apprenez la langue Bamoun (Shupamem) avec Khalisha, votre assistante vocale." },
      { name: "theme-color", content: "#FFFFFF" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.json" },
      { rel: "icon", href: "/icon-192.svg", type: "image/svg+xml" },
      { rel: "apple-touch-icon", href: "/icon-192.svg" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  // In Cloudflare Worker (SSR), `document` is undefined — render the full HTML shell.
  // In the browser (SPA / Netlify), index.html already provides the shell — just pass through.
  if (typeof document !== 'undefined') {
    return <>{children}</>;
  }
  return (
    <html lang="fr">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  return (
    <div className="flex flex-col min-h-dvh bg-background">
      <div className="flex-1">
        <Outlet />
      </div>
      <BottomNav />
    </div>
  );
}

function BottomNav() {
  const location = useLocation();
  const path = location.pathname;

  const tabs = [
    { to: '/' as const, icon: Mic, label: 'Chat' },
    { to: '/train' as const, icon: BookOpen, label: 'Entraîner' },
    { to: '/settings' as const, icon: Settings, label: 'Paramètres' },
  ];

  return (
    <nav className="flex items-center justify-around h-16 border-t border-border bg-nav-bg safe-bottom">
      {tabs.map(tab => {
        const isActive = tab.to === '/' ? path === '/' : path.startsWith(tab.to);
        return (
          <Link
            key={tab.to}
            to={tab.to}
            className={`flex flex-col items-center justify-center gap-0.5 px-4 py-2 transition-colors ${
              isActive ? 'text-nav-active' : 'text-nav-inactive'
            }`}
          >
            <tab.icon size={20} strokeWidth={isActive ? 2.5 : 1.5} />
            {isActive && <span className="text-[10px] font-medium">{tab.label}</span>}
          </Link>
        );
      })}
    </nav>
  );
}
