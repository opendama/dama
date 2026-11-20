package youtube

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"strings"
	"time"
)

type tokenResponse struct {
	AccessToken string `json:"access_token"`
	ExpiresIn   int    `json:"expires_in"`
	TokenType   string `json:"token_type"`
	Error       string `json:"error"`
	ErrorDesc   string `json:"error_description"`
}

func (p *Pool) exchangeRefreshToken(ch *Channel) (string, error) {
	if ch.RefreshToken == "" || ch.ClientID == "" || ch.ClientSecret == "" {
		return "", fmt.Errorf("media channel unavailable")
	}
	form := url.Values{}
	form.Set("client_id", ch.ClientID)
	form.Set("client_secret", ch.ClientSecret)
	form.Set("refresh_token", ch.RefreshToken)
	form.Set("grant_type", "refresh_token")

	req, err := http.NewRequest(http.MethodPost, "https://oauth2.googleapis.com/token", strings.NewReader(form.Encode()))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	client := &http.Client{Timeout: 20 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(resp.Body)
	var tr tokenResponse
	_ = json.Unmarshal(raw, &tr)
	if resp.StatusCode >= 300 || tr.AccessToken == "" {
		return "", fmt.Errorf("media channel unavailable")
	}
	return tr.AccessToken, nil
}

func (p *Pool) uploadWithAccessToken(accessToken, title, description, localPath string) (string, error) {
	if strings.TrimSpace(localPath) == "" {
		return "", fmt.Errorf("media file required")
	}
	f, err := os.Open(localPath)
	if err != nil {
		return "", err
	}
	defer f.Close()

	meta := map[string]any{
		"snippet": map[string]any{
			"title":       title,
			"description": description,
			"categoryId":  "20",
		},
		"status": map[string]any{
			"privacyStatus": "unlisted",
		},
	}
	metaJSON, err := json.Marshal(meta)
	if err != nil {
		return "", err
	}

	boundary := "dama_yt_" + strconv.FormatInt(time.Now().UnixNano(), 10)
	var body bytes.Buffer
	body.WriteString("--" + boundary + "\r\n")
	body.WriteString("Content-Type: application/json; charset=UTF-8\r\n\r\n")
	body.Write(metaJSON)
	body.WriteString("\r\n--" + boundary + "\r\n")
	body.WriteString("Content-Type: application/octet-stream\r\n\r\n")
	if _, err := io.Copy(&body, f); err != nil {
		return "", err
	}
	body.WriteString("\r\n--" + boundary + "--")

	req, err := http.NewRequest(http.MethodPost,
		"https://www.googleapis.com/youtube/v3/videos?part=snippet,status&uploadType=multipart",
		&body,
	)
	if err != nil {
		return "", err
	}
	req.Header.Set("Authorization", "Bearer "+accessToken)
	req.Header.Set("Content-Type", "multipart/related; boundary="+boundary)
	client := &http.Client{Timeout: 120 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 300 {
		return "", fmt.Errorf("media upload unavailable")
	}
	var parsed struct {
		ID string `json:"id"`
	}
	if err := json.Unmarshal(raw, &parsed); err != nil {
		return "", err
	}
	if parsed.ID == "" {
		return "", fmt.Errorf("media upload unavailable")
	}
	return parsed.ID, nil
}

func (p *Pool) preflightAPI(ch *Channel) (bool, error) {
	if ch.APIKey == "" && ch.RefreshToken == "" {
		if p.allowStub {
			return true, nil
		}
		return false, fmt.Errorf("media channel credentials required")
	}
	if ch.APIKey != "" {
		endpoint := "https://www.googleapis.com/youtube/v3/channels?part=id&mine=true&key=" + url.QueryEscape(ch.APIKey)
		if ch.ChannelID != "" {
			endpoint = "https://www.googleapis.com/youtube/v3/channels?part=id&id=" + url.QueryEscape(ch.ChannelID) + "&key=" + url.QueryEscape(ch.APIKey)
		}
		client := &http.Client{Timeout: 10 * time.Second}
		resp, err := client.Get(endpoint)
		if err != nil {
			return false, err
		}
		defer resp.Body.Close()
		if resp.StatusCode >= 400 {
			return false, fmt.Errorf("media channel unavailable")
		}
	}
	if ch.RefreshToken != "" {
		_, err := p.exchangeRefreshToken(ch)
		if err != nil {
			return false, err
		}
	}
	return true, nil
}
