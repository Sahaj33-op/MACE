//go:build !windows

package launcher

// PreventSleep is a no-op on non-Windows platforms.
func PreventSleep(prevent bool) {}
