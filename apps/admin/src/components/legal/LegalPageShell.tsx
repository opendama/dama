"use client";

import type { LegalSection } from "@/types/legal-chrome";

type LegalPageShellProps = {
  title: string;
  sections: LegalSection[];
  supportEmail?: string;
};

/** Renders DB legal sections only - heading, body, optional contact trail + support email. */
export function LegalPageShell({ title, sections, supportEmail }: LegalPageShellProps) {
  const email = (supportEmail || "").trim();

  return (
    <article className="mx-auto max-w-2xl space-y-8">
      <h1 className="font-display text-3xl font-bold tracking-tight text-[var(--dama-text)]">
        {title}
      </h1>
      {sections.map((section) => {
        const heading = (section.heading || "").trim();
        const body = (section.body || "").trim();
        const lead = (section.contact_lead || "").trim();
        const trail = (section.contact_trail || "").trim();
        const showContact = section.uses_support_email && email.length > 0;
        return (
          <section key={`${heading}::${body}`} className="space-y-3">
            {heading ? (
              <h2 className="font-display text-xl font-semibold text-[var(--dama-gold)]">
                {heading}
              </h2>
            ) : null}
            {body ? (
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--dama-muted)]">
                {body}
              </p>
            ) : null}
            {showContact ? (
              <p className="text-sm text-[var(--dama-muted)]">
                {lead ? `${lead} ` : null}
                <a
                  href={`mailto:${email}`}
                  className="text-[var(--dama-gold)] underline underline-offset-2"
                >
                  {email}
                </a>
                {trail ? ` ${trail}` : null}
              </p>
            ) : null}
          </section>
        );
      })}
    </article>
  );
}
