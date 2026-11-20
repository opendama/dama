package invoices

import (
	"bytes"
	"fmt"
	"strconv"
	"strings"
	"time"
)

type CampaignLine struct {
	Title       string
	Status      string
	Impressions int64
	Clicks      int64
}

// PDFChrome holds DB-backed invoice PDF copy (ad_runtime_chrome). Fail closed when empty.
type PDFChrome struct {
	Title             string
	GeneratedTemplate string
	PublisherTemplate string
	CurrencyTemplate  string
	TableHeader       string
	TableRule         string
	LineTemplate      string
	TotalsTemplate    string
	SettleBlurb       string
}

type InvoiceInput struct {
	PublisherID string
	Currency    string
	Lines       []CampaignLine
	Chrome      PDFChrome
}

func (c PDFChrome) complete() bool {
	return strings.TrimSpace(c.Title) != "" &&
		strings.TrimSpace(c.GeneratedTemplate) != "" &&
		strings.TrimSpace(c.PublisherTemplate) != "" &&
		strings.TrimSpace(c.CurrencyTemplate) != "" &&
		strings.TrimSpace(c.TableHeader) != "" &&
		strings.TrimSpace(c.TableRule) != "" &&
		strings.TrimSpace(c.LineTemplate) != "" &&
		strings.TrimSpace(c.TotalsTemplate) != "" &&
		strings.TrimSpace(c.SettleBlurb) != ""
}

func applyTpl(tpl string, pairs map[string]string) string {
	out := tpl
	for k, v := range pairs {
		out = strings.ReplaceAll(out, "{"+k+"}", v)
	}
	return out
}

func formatCTR(impressions, clicks int64) string {
	if impressions <= 0 {
		return "0.00"
	}
	return strconv.FormatFloat(float64(clicks)/float64(impressions)*100, 'f', 2, 64)
}

// BuildSimplePDF creates a minimal valid PDF invoice (no external deps).
// Caller must supply Currency and complete PDFChrome from platform_settings.
func BuildSimplePDF(in InvoiceInput) []byte {
	if in.Currency == "" || !in.Chrome.complete() {
		return []byte("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n")
	}
	var impressions, clicks int64
	var b strings.Builder
	ch := in.Chrome
	b.WriteString(ch.Title)
	b.WriteString("\n")
	b.WriteString(applyTpl(ch.GeneratedTemplate, map[string]string{
		"when": time.Now().UTC().Format(time.RFC3339),
	}))
	b.WriteString("\n")
	b.WriteString(applyTpl(ch.PublisherTemplate, map[string]string{
		"publisher": in.PublisherID,
	}))
	b.WriteString("\n")
	b.WriteString(applyTpl(ch.CurrencyTemplate, map[string]string{
		"currency": in.Currency,
	}))
	b.WriteString("\n\n")
	b.WriteString(ch.TableHeader)
	b.WriteString("\n")
	b.WriteString(ch.TableRule)
	b.WriteString("\n")
	for _, line := range in.Lines {
		impressions += line.Impressions
		clicks += line.Clicks
		b.WriteString(applyTpl(ch.LineTemplate, map[string]string{
			"title":       sanitize(line.Title),
			"status":      sanitize(line.Status),
			"impressions": strconv.FormatInt(line.Impressions, 10),
			"clicks":      strconv.FormatInt(line.Clicks, 10),
			"ctr":         formatCTR(line.Impressions, line.Clicks),
		}))
		b.WriteString("\n")
	}
	b.WriteString("\n")
	b.WriteString(applyTpl(ch.TotalsTemplate, map[string]string{
		"impressions": strconv.FormatInt(impressions, 10),
		"clicks":      strconv.FormatInt(clicks, 10),
		"ctr":         formatCTR(impressions, clicks),
	}))
	b.WriteString("\n\n")
	b.WriteString(ch.SettleBlurb)
	b.WriteString("\n")

	content := b.String()
	content = strings.ReplaceAll(content, "\\", "\\\\")
	content = strings.ReplaceAll(content, "(", "\\(")
	content = strings.ReplaceAll(content, ")", "\\)")

	stream := fmt.Sprintf("BT /F1 10 Tf 40 780 Td 14 TL (%s) Tj ET", strings.ReplaceAll(content, "\n", ") Tj T* ("))

	var out bytes.Buffer
	objs := []string{
		"1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj\n",
		"2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj\n",
		"3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>endobj\n",
		fmt.Sprintf("4 0 obj<< /Length %d >>stream\n%s\nendstream\nendobj\n", len(stream), stream),
		"5 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj\n",
	}

	out.WriteString("%PDF-1.4\n")
	offsets := []int{0}
	for _, obj := range objs {
		offsets = append(offsets, out.Len())
		out.WriteString(obj)
	}
	xrefStart := out.Len()
	out.WriteString(fmt.Sprintf("xref\n0 %d\n", len(offsets)))
	out.WriteString("0000000000 65535 f \n")
	for i := 1; i < len(offsets); i++ {
		out.WriteString(fmt.Sprintf("%010d 00000 n \n", offsets[i]))
	}
	out.WriteString(fmt.Sprintf("trailer<< /Size %d /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF\n", len(offsets), xrefStart))
	return out.Bytes()
}

func sanitize(s string) string {
	s = strings.ReplaceAll(s, "|", "/")
	if len(s) > 40 {
		return s[:40]
	}
	return s
}
