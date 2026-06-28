//go:build !windows

package launcher

import "context"

// SetupTray is a no-op on non-Windows platforms.
func SetupTray(ctx context.Context) {}

// RemoveTray is a no-op on non-Windows platforms.
func RemoveTray() {}
