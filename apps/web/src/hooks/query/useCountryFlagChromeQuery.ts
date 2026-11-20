import { restClient } from "@/lib/api";
import { QueryStale } from "@/lib/query-policy";
import { useQuery } from "@tanstack/react-query";

export type CountryFlagChrome = {
  source?: string;
  image_url_template?: string;
  country_flag_chrome_unavailable?: string;
};

export function countryFlagChromeQueryKey() {
  return ["public", "country-flag-chrome"] as const;
}

export function isCountryFlagChromeReady(
  data: CountryFlagChrome | undefined | null,
): data is Required<Pick<CountryFlagChrome, "image_url_template">> & CountryFlagChrome {
  const tmpl = (data?.image_url_template || "").trim();
  return Boolean(data && tmpl.includes("{code}"));
}

/** DB-backed flag image URL template (`{code}` → lowercase ISO-2). Fail closed when missing. */
export function useCountryFlagChromeQuery(enabled = true) {
  return useQuery({
    queryKey: countryFlagChromeQueryKey(),
    enabled,
    staleTime: QueryStale.platform,
    queryFn: async () => {
      const { data } = await restClient.get<CountryFlagChrome>("/public/country-flag-chrome");
      return data;
    },
  });
}
