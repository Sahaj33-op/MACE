package servermanager

import (
	"testing"
	"time"
)

func TestMatchCron(t *testing.T) {
	// Let's mock a time: Sunday, June 28, 2026, 12:00:00 (12:00 PM)
	// Sunday is Weekday 0
	// June is Month 6
	testTime := time.Date(2026, time.June, 28, 12, 0, 0, 0, time.UTC)

	tests := []struct {
		expr  string
		want  bool
		name  string
	}{
		{"0 12 28 6 0", true, "Exact match"},
		{"0 12 28 6 7", true, "Sunday represented as 7"},
		{"0 12 28 6 1", false, "Wrong day of week"},
		{"* * * * *", true, "All match"},
		{"*/5 * * * *", true, "Minute step match (0 % 5 == 0)"},
		{"*/7 * * * *", true, "Minute step match (0 % 7 == 0)"},
		{"0-30 * * * *", true, "Range match (0 is in 0-30)"},
		{"10-30 * * * *", false, "Range mismatch (0 is not in 10-30)"},
		{"0,15,30 * * * *", true, "List match (0 is in list)"},
		{"5,15,30 * * * *", false, "List mismatch (0 is not in list)"},
		{"0 10-14/2 28 6 0", true, "Hour range with step match (12 satisfies 10-14/2)"},
		{"0 10-14/3 28 6 0", false, "Hour range with step mismatch (12 does not satisfy 10-14/3)"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := MatchCron(tt.expr, testTime)
			if got != tt.want {
				t.Errorf("MatchCron(%q) = %v; want %v", tt.expr, got, tt.want)
			}
		})
	}
}
