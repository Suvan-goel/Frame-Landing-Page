/* eslint-disable @next/next/no-html-link-for-pages */
import type { ReactNode } from "react";
import { chatGPTSignOutPath } from "@/app/chatgpt-auth";
import { BrandWordmark } from "@/app/components/brand-wordmark";

export type AdminSection =
  | "waitlist"
  | "email"
  | "automated_emails"
  | "preorders"
  | "contributors";

const ADMIN_NAVIGATION = [
  {
    id: "waitlist",
    href: "/admin/waitlist",
    index: "01",
    label: "Waitlist",
    description: "Leads and insights",
  },
  {
    id: "email",
    href: "/admin/email",
    index: "02",
    label: "Campaigns",
    description: "Create and send updates",
  },
  {
    id: "automated_emails",
    href: "/admin/automated-emails",
    index: "03",
    label: "Automated emails",
    description: "Templates and triggers",
  },
  {
    id: "preorders",
    href: "/admin/preorders",
    index: "04",
    label: "Pre-orders",
    description: "Orders and operations",
  },
] as const;

type AdminDashboardShellProps = {
  activeSection: AdminSection;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  description: ReactNode;
  eyebrow?: string;
  title: ReactNode;
  userEmail: string;
};

export function AdminDashboardShell({
  activeSection,
  actions,
  children,
  className,
  description,
  eyebrow = "Owner workspace",
  title,
  userEmail,
}: AdminDashboardShellProps) {
  return (
    <main className="admin-page admin-app">
      <div className="admin-app__layout">
        <aside className="admin-sidebar">
          <div>
            <a className="admin-sidebar__brand" href="/" aria-label="Frame home">
              <BrandWordmark variant="light" priority />
            </a>
            <div className="admin-sidebar__context">
              <span>Private workspace</span>
              <strong>Operations</strong>
            </div>

            <nav className="admin-navigation" aria-label="Admin dashboard">
              <p>Workspace</p>
              {ADMIN_NAVIGATION.map((item) => {
                const isActive = activeSection === item.id;
                return (
                  <a
                    className={isActive ? "is-active" : undefined}
                    href={item.href}
                    aria-current={isActive ? "page" : undefined}
                    key={item.id}
                  >
                    <span className="admin-navigation__index" aria-hidden="true">
                      {item.index}
                    </span>
                    <span className="admin-navigation__copy">
                      <strong>{item.label}</strong>
                      <small>{item.description}</small>
                    </span>
                  </a>
                );
              })}
            </nav>
          </div>

          <div className="admin-sidebar__account">
            <span>Signed in as</span>
            <strong title={userEmail}>{userEmail}</strong>
            <div>
              <a href="/">View site</a>
              <a href={chatGPTSignOutPath("/")}>Sign out</a>
            </div>
          </div>
        </aside>

        <div className={`admin-shell admin-app__content${className ? ` ${className}` : ""}`}>
          <header className="admin-page-header">
            <div className="admin-page-header__copy">
              <p className="admin-page-header__eyebrow">
                <span aria-hidden="true" />
                {eyebrow}
              </p>
              <h1>{title}</h1>
              <p>{description}</p>
            </div>
            {actions ? <div className="admin-page-actions">{actions}</div> : null}
          </header>

          <div className="admin-app__body">{children}</div>
        </div>
      </div>
    </main>
  );
}
