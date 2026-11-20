"use client";

import { SignInLink } from "@/components/auth/SignInLink";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PaymentsGeoSkeleton } from "@/components/ui/shimmer-skeletons";
import { useSaveConsoleGeoPaymentMutation } from "@/hooks/mutation";
import { useAdminConsoleChromeQuery, useConsoleGeoPaymentQuery } from "@/hooks/query";
import { useIsConsoleRole } from "@/hooks/useIsConsoleRole";
import { adminConsoleChromeUnavailable } from "@/lib/chrome-unavailable";
import { useAuthStore } from "@/store/auth";
import { isAdminConsoleChromeReady } from "@/types/admin-console-chrome";
import { useEffect, useState } from "react";

export default function AdminPaymentsGeoPage() {
  const token = useAuthStore((s) => s.token);
  const { isConsole: isAdmin, isLoading: roleLoading } = useIsConsoleRole();
  const chromeQuery = useAdminConsoleChromeQuery(true);
  const chrome = isAdminConsoleChromeReady(chromeQuery.data)
    ? chromeQuery.data.payments
    : undefined;

  const [ethiopiaCountry, setEthiopiaCountry] = useState("");
  const [privateCity, setPrivateCity] = useState("");
  const [privateRegion, setPrivateRegion] = useState("");

  const geoQuery = useConsoleGeoPaymentQuery(token, Boolean(isAdmin));
  const saveGeo = useSaveConsoleGeoPaymentMutation(token);

  useEffect(() => {
    if (!geoQuery.data) return;
    setEthiopiaCountry(geoQuery.data.ethiopia_country || "");
    setPrivateCity(geoQuery.data.private_default_city || "");
    setPrivateRegion(geoQuery.data.private_default_region || "");
  }, [geoQuery.data]);

  if (chromeQuery.isLoading) {
    return (
      <div className="space-y-4">
        <PaymentsGeoSkeleton />
      </div>
    );
  }

  if (!chrome) {
    return (
      <div className="p-6 text-sm text-[var(--dama-muted)]">
        {adminConsoleChromeUnavailable(chromeQuery.data, chromeQuery.error)}
      </div>
    );
  }

  const pageLoading = roleLoading || (isAdmin && geoQuery.isLoading);
  const savePending = (chrome.save_geo_payment_pending || "").trim();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{chrome.geo_page_title}</h1>
        <p className="mt-1 text-sm text-[var(--dama-muted)]">{chrome.geo_page_blurb}</p>
      </div>

      {roleLoading ? (
        <PaymentsGeoSkeleton />
      ) : !isAdmin ? (
        <p className="text-sm">
          <SignInLink className="text-[var(--dama-gold)] underline" />
        </p>
      ) : pageLoading ? (
        <PaymentsGeoSkeleton />
      ) : (
        <div className="space-y-4 rounded-xl border border-[var(--dama-border)] bg-[var(--dama-card)] p-5">
          <h2 className="font-semibold text-[var(--dama-gold)]">
            {chrome.geo_payment_section_title}
          </h2>
          {geoQuery.error ? (
            <p className="text-sm text-[var(--dama-danger)]">{chrome.geo_payment_load_failed}</p>
          ) : (
            <>
              <Field id="payments-geo-ethiopia" label={chrome.geo_payment_ethiopia_country_label}>
                <Input
                  id="payments-geo-ethiopia"
                  className="uppercase"
                  value={ethiopiaCountry}
                  onChange={(e) => setEthiopiaCountry(e.target.value)}
                  disabled={saveGeo.isPending}
                />
              </Field>
              <Field id="payments-geo-city" label={chrome.geo_payment_private_city_label}>
                <Input
                  id="payments-geo-city"
                  value={privateCity}
                  onChange={(e) => setPrivateCity(e.target.value)}
                  disabled={saveGeo.isPending}
                />
              </Field>
              <Field id="payments-geo-region" label={chrome.geo_payment_private_region_label}>
                <Input
                  id="payments-geo-region"
                  value={privateRegion}
                  onChange={(e) => setPrivateRegion(e.target.value)}
                  disabled={saveGeo.isPending}
                />
              </Field>
              <Button
                variant="gold"
                isLoading={saveGeo.isPending}
                pendingLabel={savePending}
                disabled={
                  saveGeo.isPending ||
                  !ethiopiaCountry.trim() ||
                  !privateCity.trim() ||
                  !privateRegion.trim()
                }
                onClick={() => {
                  saveGeo.mutate({
                    ethiopia_country: ethiopiaCountry.trim().toUpperCase(),
                    private_default_city: privateCity.trim(),
                    private_default_region: privateRegion.trim(),
                  });
                }}
              >
                {chrome.save_geo_payment_action}
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
