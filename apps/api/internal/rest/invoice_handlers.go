package rest

import (
	"fmt"
	"net/http"
	"strings"

	"dama/apps/api/internal/auth"
	"dama/apps/api/internal/geo"
	"dama/apps/api/internal/invoices"
	"dama/apps/api/internal/store"
)

type InvoiceAPI struct {
	Ads      *store.AdStore
	Settings *store.SettingsStore
	Locate   *geo.Resolver
}

func (a *InvoiceAPI) invoicePDFChrome() (invoices.PDFChrome, bool) {
	if a.Settings == nil {
		return invoices.PDFChrome{}, false
	}
	ch := invoices.PDFChrome{
		Title:             a.Settings.AdRuntimeChromeString("invoice_pdf_title"),
		GeneratedTemplate: a.Settings.AdRuntimeChromeString("invoice_pdf_generated_template"),
		PublisherTemplate: a.Settings.AdRuntimeChromeString("invoice_pdf_publisher_template"),
		CurrencyTemplate:  a.Settings.AdRuntimeChromeString("invoice_pdf_currency_template"),
		TableHeader:       a.Settings.AdRuntimeChromeString("invoice_pdf_table_header"),
		TableRule:         a.Settings.AdRuntimeChromeString("invoice_pdf_table_rule"),
		LineTemplate:      a.Settings.AdRuntimeChromeString("invoice_pdf_line_template"),
		TotalsTemplate:    a.Settings.AdRuntimeChromeString("invoice_pdf_totals_template"),
		SettleBlurb:       a.Settings.AdRuntimeChromeString("invoice_pdf_settle_blurb"),
	}
	if strings.TrimSpace(ch.Title) == "" ||
		strings.TrimSpace(ch.GeneratedTemplate) == "" ||
		strings.TrimSpace(ch.PublisherTemplate) == "" ||
		strings.TrimSpace(ch.CurrencyTemplate) == "" ||
		strings.TrimSpace(ch.TableHeader) == "" ||
		strings.TrimSpace(ch.TableRule) == "" ||
		strings.TrimSpace(ch.LineTemplate) == "" ||
		strings.TrimSpace(ch.TotalsTemplate) == "" ||
		strings.TrimSpace(ch.SettleBlurb) == "" {
		return invoices.PDFChrome{}, false
	}
	return ch, true
}

func (a *InvoiceAPI) PublisherPDF(w http.ResponseWriter, r *http.Request) {
	userID := auth.UserIDFromContext(r.Context())
	if userID == "" {
		writeAdsErr(w, a.Settings, http.StatusUnauthorized, "err_unauthorized")
		return
	}
	pdfChrome, ok := a.invoicePDFChrome()
	if !ok {
		writeAdsErr(w, a.Settings, http.StatusServiceUnavailable, "err_invoice_pdf_unavailable")
		return
	}
	list, err := a.Ads.ListByPublisher(r.Context(), userID)
	if err != nil {
		writeAdsErr(w, a.Settings, http.StatusInternalServerError, "err_invoice_list_failed")
		return
	}
	if a.Settings == nil {
		writeAdsErr(w, a.Settings, http.StatusServiceUnavailable, "err_invoice_currency_unavailable")
		return
	}
	cur := a.Settings.Currency()
	if cur.Source != "database" || cur.Global == "" {
		writeAdsErr(w, a.Settings, http.StatusServiceUnavailable, "err_invoice_currency_unavailable")
		return
	}
	payerCC := resolvePayerCountryFromRequest(r, a.Locate, a.Settings, 0, 0)
	currency := a.Settings.CurrencyForCountry(payerCC)
	if payerCC == "" || currency == "" {
		writeAdsErr(w, a.Settings, http.StatusServiceUnavailable, "err_invoice_currency_unavailable")
		return
	}
	enums := a.Settings.ClientEnums()
	lines := make([]invoices.CampaignLine, 0, len(list))
	for _, c := range list {
		statusDisp := strings.TrimSpace(store.StatusLabel(enums.CampaignStatusLabels, c.Status))
		if statusDisp == "" {
			// Fail closed: omit unlabeled rows rather than invent raw status codes.
			continue
		}
		title := strings.TrimSpace(c.Title)
		if title == "" {
			continue
		}
		lines = append(lines, invoices.CampaignLine{
			Title:       title,
			Status:      statusDisp,
			Impressions: c.Impressions,
			Clicks:      c.Clicks,
		})
	}
	pdf := invoices.BuildSimplePDF(invoices.InvoiceInput{
		PublisherID: userID,
		Currency:    currency,
		Lines:       lines,
		Chrome:      pdfChrome,
	})
	if len(pdf) < 40 {
		writeAdsErr(w, a.Settings, http.StatusServiceUnavailable, "err_invoice_pdf_unavailable")
		return
	}
	filename := strings.TrimSpace(a.Settings.AdRuntimeChrome().PublisherInvoiceFilename)
	if filename == "" {
		writeAdsErr(w, a.Settings, http.StatusServiceUnavailable, "err_invoice_pdf_unavailable")
		return
	}
	w.Header().Set("Content-Type", "application/pdf")
	w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, filename))
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(pdf)
}
