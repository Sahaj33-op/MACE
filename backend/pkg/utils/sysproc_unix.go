//go:build !windows
// +build !windows

package utils

import "os/exec"

// HideWindow does nothing on Unix-like systems.
func HideWindow(cmd *exec.Cmd) {
}
