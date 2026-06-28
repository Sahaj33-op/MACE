//go:build windows

package launcher

import "syscall"

var (
	kernel32                = syscall.NewLazyDLL("kernel32.dll")
	setThreadExecutionState = kernel32.NewProc("SetThreadExecutionState")
)

const (
	ES_SYSTEM_REQUIRED  = 0x00000001
	ES_DISPLAY_REQUIRED = 0x00000002
	ES_CONTINUOUS       = 0x80000000
)

// PreventSleep prevents or restores the host system's capability to sleep.
func PreventSleep(prevent bool) {
	if prevent {
		setThreadExecutionState.Call(uintptr(ES_SYSTEM_REQUIRED | ES_CONTINUOUS))
	} else {
		setThreadExecutionState.Call(uintptr(ES_CONTINUOUS))
	}
}
