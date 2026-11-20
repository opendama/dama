package geo

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"
)

type Result struct {
	CountryCode string  `json:"country_code"`
	CountryName string  `json:"country_name,omitempty"`
	Region      string  `json:"region,omitempty"`
	City        string  `json:"city,omitempty"`
	Source      string  `json:"-"` // gps | geoip | client | dev_default - never serialize to clients
	Latitude    float64 `json:"latitude,omitempty"`
	Longitude   float64 `json:"longitude,omitempty"`
}

type Resolver struct {
	HTTP *http.Client
}

func NewResolver() *Resolver {
	return &Resolver{
		HTTP: &http.Client{Timeout: 4 * time.Second},
	}
}

// ClientIP mirrors python-sample extract_client_ip:
// X-Forwarded-For (first hop) → CF-Connecting-IP → True-Client-IP → RemoteAddr.
func ClientIP(r *http.Request) string {
	if r == nil {
		return ""
	}
	if xff := strings.TrimSpace(r.Header.Get("X-Forwarded-For")); xff != "" {
		parts := strings.Split(xff, ",")
		if len(parts) > 0 {
			if ip := strings.TrimSpace(parts[0]); ip != "" {
				return stripPort(ip)
			}
		}
	}
	if cf := strings.TrimSpace(r.Header.Get("CF-Connecting-IP")); cf != "" {
		return stripPort(cf)
	}
	if tc := strings.TrimSpace(r.Header.Get("True-Client-IP")); tc != "" {
		return stripPort(tc)
	}
	return stripPort(r.RemoteAddr)
}

func stripPort(addr string) string {
	host, _, err := net.SplitHostPort(addr)
	if err != nil {
		return strings.TrimSpace(addr)
	}
	return strings.TrimSpace(host)
}

// PrivateDefault holds DB-backed localhost invent fields (geo_payment.*).
type PrivateDefault struct {
	CountryCode string
	City        string
	Region      string
}

// Resolve prefers GPS reverse-geocode (Nominatim), then GeoIP, then private-IP
// invent (reference subscription/global-access parity) via privateDefault from DB.
// countryHint/allowClientHint are retained for call-site compatibility but never
// invent a country from the client (reference pay geo; E2E uses XFF headers).
func (r *Resolver) Resolve(
	ctx context.Context,
	countryHint string,
	allowClientHint bool,
	lat, lng float64,
	clientIP string,
	privateDefault PrivateDefault,
) (*Result, error) {
	_ = countryHint
	_ = allowClientHint

	// Map / device GPS → country (reference BranchLocationPinField + Nominatim pattern).
	if lat != 0 || lng != 0 {
		if geo, err := r.reverseGeocode(ctx, lat, lng); err == nil && geo != nil && len(geo.CountryCode) == 2 {
			geo.Source = "gps"
			geo.Latitude = lat
			geo.Longitude = lng
			return geo, nil
		}
	}

	ip := strings.TrimSpace(clientIP)
	if ip == "" || isPrivateIP(ip) {
		// Reference: localhost → domestic country + DB city for pay + subscription geo.
		cc := strings.ToUpper(strings.TrimSpace(privateDefault.CountryCode))
		city := strings.TrimSpace(privateDefault.City)
		if len(cc) == 2 && city != "" {
			return &Result{
				CountryCode: cc,
				City:        city,
				Region:      strings.TrimSpace(privateDefault.Region),
				Source:      "dev_default",
				Latitude:    lat,
				Longitude:   lng,
			}, nil
		}
		return &Result{CountryCode: "", Source: "geoip_unavailable"}, nil
	}

	geo, err := r.lookupIP(ctx, ip)
	if err != nil {
		return &Result{CountryCode: "", Source: "geoip_error"}, nil
	}
	return geo, nil
}

func (r *Resolver) lookupIP(ctx context.Context, ip string) (*Result, error) {
	// Reference parity: ipinfo.io when DAMA_IPINFO_TOKEN is set; otherwise ipapi.co.
	token := strings.TrimSpace(os.Getenv("DAMA_IPINFO_TOKEN"))
	if token != "" {
		return r.lookupIPInfo(ctx, ip, token)
	}
	return r.lookupIPAPI(ctx, ip)
}

func (r *Resolver) lookupIPInfo(ctx context.Context, ip, token string) (*Result, error) {
	u := "https://ipinfo.io/" + ip + "/json?token=" + url.QueryEscape(token)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", "dama-geo/1")
	resp, err := r.HTTP.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		return nil, fmt.Errorf("location unavailable")
	}
	var parsed struct {
		Country string `json:"country"`
		Region  string `json:"region"`
		City    string `json:"city"`
		Loc     string `json:"loc"`
		Error   string `json:"error"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&parsed); err != nil {
		return nil, err
	}
	if strings.TrimSpace(parsed.Error) != "" {
		return nil, fmt.Errorf("location unavailable")
	}
	cc := strings.ToUpper(strings.TrimSpace(parsed.Country))
	if len(cc) != 2 {
		return nil, fmt.Errorf("location unavailable")
	}
	var lat, lng float64
	if parts := strings.Split(strings.TrimSpace(parsed.Loc), ","); len(parts) == 2 {
		fmt.Sscanf(parts[0], "%f", &lat)
		fmt.Sscanf(parts[1], "%f", &lng)
	}
	return &Result{
		CountryCode: cc,
		Region:      parsed.Region,
		City:        parsed.City,
		Source:      "geoip",
		Latitude:    lat,
		Longitude:   lng,
	}, nil
}

func (r *Resolver) lookupIPAPI(ctx context.Context, ip string) (*Result, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, "https://ipapi.co/"+ip+"/json/", nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", "dama-geo/1")
	resp, err := r.HTTP.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		return nil, fmt.Errorf("location unavailable")
	}
	var parsed struct {
		CountryCode string  `json:"country_code"`
		CountryName string  `json:"country_name"`
		Region      string  `json:"region"`
		City        string  `json:"city"`
		Latitude    float64 `json:"latitude"`
		Longitude   float64 `json:"longitude"`
		Error       bool    `json:"error"`
		Reason      string  `json:"reason"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&parsed); err != nil {
		return nil, err
	}
	if parsed.Error {
		return nil, fmt.Errorf("location unavailable")
	}
	return &Result{
		CountryCode: strings.ToUpper(parsed.CountryCode),
		CountryName: strings.TrimSpace(parsed.CountryName),
		Region:      parsed.Region,
		City:        parsed.City,
		Source:      "geoip",
		Latitude:    parsed.Latitude,
		Longitude:   parsed.Longitude,
	}, nil
}

// nominatimAddress mirrors Smart Menu reverseGeocodeWithGeoapify address fields.
type nominatimAddress struct {
	CountryCode   string `json:"country_code"`
	Country       string `json:"country"`
	State         string `json:"state"`
	StateDistrict string `json:"state_district"`
	Region        string `json:"region"`
	City          string `json:"city"`
	Town          string `json:"town"`
	Municipality  string `json:"municipality"`
	Village       string `json:"village"`
	Neighbourhood string `json:"neighbourhood"`
	Suburb        string `json:"suburb"`
	Quarter       string `json:"quarter"`
	Ward          string `json:"ward"`
	CityDistrict  string `json:"city_district"`
	District      string `json:"district"`
	County        string `json:"county"`
	Hamlet        string `json:"hamlet"`
}

func firstNonEmptyTrimmed(vals ...string) string {
	for _, v := range vals {
		if s := strings.TrimSpace(v); s != "" {
			return s
		}
	}
	return ""
}

// nominatimCityAndSubCity matches smart-menu-sample reverseGeocodeWithGeoapify:
// city = state_district|city|town|municipality|state|region|village;
// subCity = first of neighbourhood|suburb|quarter|ward|city_district|district|county|hamlet|village ≠ city.
func nominatimCityAndSubCity(a nominatimAddress) (city, subCity string) {
	city = firstNonEmptyTrimmed(
		a.StateDistrict, a.City, a.Town, a.Municipality, a.State, a.Region, a.Village,
	)
	for _, opt := range []string{
		a.Neighbourhood, a.Suburb, a.Quarter, a.Ward, a.CityDistrict, a.District, a.County, a.Hamlet, a.Village,
	} {
		s := strings.TrimSpace(opt)
		if s != "" && !strings.EqualFold(s, city) {
			return city, s
		}
	}
	return city, ""
}

// reverseGeocode uses Nominatim with Smart Menu pin reverse parity (zoom 18→16,
// English labels only). Fail-fast: Docker/offline often cannot reach Nominatim -
// short timeout so Resolve can fall through to GeoIP / private default.
// Result.Region = main city; Result.City = sub-city/district (ads form mapping).
func (r *Resolver) reverseGeocode(ctx context.Context, lat, lng float64) (*Result, error) {
	if geo, err := r.nominatimReverse(ctx, lat, lng, "18"); err == nil && geo != nil {
		return geo, nil
	}
	return r.nominatimReverse(ctx, lat, lng, "16")
}

func (r *Resolver) nominatimReverse(ctx context.Context, lat, lng float64, zoom string) (*Result, error) {
	u := url.URL{
		Scheme: "https",
		Host:   "nominatim.openstreetmap.org",
		Path:   "/reverse",
	}
	q := u.Query()
	q.Set("format", "json")
	q.Set("lat", fmt.Sprintf("%f", lat))
	q.Set("lon", fmt.Sprintf("%f", lng))
	q.Set("zoom", zoom)
	q.Set("addressdetails", "1")
	q.Set("extratags", "1")
	q.Set("namedetails", "1")
	// Standard Latin/English names only (no Amharic / local-script primary labels).
	q.Set("accept-language", "en")
	u.RawQuery = q.Encode()

	// Keep reverse short so a blocked outbound path does not stall locate/create.
	revCtx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()
	client := &http.Client{Timeout: 3 * time.Second}
	if r.HTTP != nil && r.HTTP.Transport != nil {
		client.Transport = r.HTTP.Transport
	}

	req, err := http.NewRequestWithContext(revCtx, http.MethodGet, u.String(), nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", "dama-geo/1 (payment-locate)")
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Accept-Language", "en")
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		_, _ = io.Copy(io.Discard, resp.Body)
		return nil, fmt.Errorf("reverse geocode unavailable")
	}
	var parsed struct {
		Address nominatimAddress `json:"address"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&parsed); err != nil {
		return nil, err
	}
	cc := strings.ToUpper(strings.TrimSpace(parsed.Address.CountryCode))
	if len(cc) != 2 {
		return nil, fmt.Errorf("reverse geocode missing country")
	}
	city, subCity := nominatimCityAndSubCity(parsed.Address)
	if city == "" {
		return nil, fmt.Errorf("reverse geocode missing city")
	}
	return &Result{
		CountryCode: cc,
		CountryName: strings.TrimSpace(parsed.Address.Country),
		Region:      city,    // main city / state_district (form: State / province / region)
		City:        subCity, // sub-city / district (form: City / district)
		Source:      "gps",
	}, nil
}

func isPrivateIP(ipStr string) bool {
	ip := net.ParseIP(ipStr)
	if ip == nil {
		return true
	}
	private := []string{
		"10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16", "127.0.0.0/8", "::1/128", "fc00::/7",
	}
	for _, cidr := range private {
		_, n, err := net.ParseCIDR(cidr)
		if err == nil && n.Contains(ip) {
			return true
		}
	}
	return false
}

// IsPrivate reports whether ip is loopback/private (exported for handlers/tests).
func IsPrivate(ip string) bool {
	return isPrivateIP(strings.TrimSpace(ip))
}
