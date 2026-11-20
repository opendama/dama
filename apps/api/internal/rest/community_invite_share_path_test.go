package rest

import "testing"

func TestCommunityInviteSharePathTemplate(t *testing.T) {
	const want = "/?view=tournaments&source=community&code={code}"
	cases := []string{
		"/?view=events&code={code}",
		"/events/public?code={code}",
		"/events/join?code={code}",
	}
	for _, in := range cases {
		if got := communityInviteSharePathTemplate(in); got != want {
			t.Fatalf("template %q: got %q want %q", in, got, want)
		}
	}
	keep := "/?view=tournaments&source=community&code={code}"
	if got := communityInviteSharePathTemplate(keep); got != keep {
		t.Fatalf("already community: got %q", got)
	}
}

func TestCommunityInviteSharePath(t *testing.T) {
	const code = "ABCD12"
	const want = "/?view=tournaments&source=community&code=ABCD12"
	cases := []string{
		"/?view=events&code=ABCD12",
		"/events/public?code=ABCD12",
		"/events/join?code=ABCD12",
	}
	for _, in := range cases {
		if got := communityInviteSharePath(in, code); got != want {
			t.Fatalf("path %q: got %q want %q", in, got, want)
		}
	}
	keep := "/?view=tournaments&source=community&code=ABCD12"
	if got := communityInviteSharePath(keep, code); got != keep {
		t.Fatalf("already community: got %q", got)
	}
}
