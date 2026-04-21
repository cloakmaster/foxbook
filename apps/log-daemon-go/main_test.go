package main

import (
	"strings"
	"testing"
)

func TestBannerNonEmpty(t *testing.T) {
	got := banner()
	if got == "" {
		t.Fatal("banner() returned empty string")
	}
	if !strings.Contains(got, "foxbook") {
		t.Errorf("banner() = %q; want string containing \"foxbook\"", got)
	}
}
