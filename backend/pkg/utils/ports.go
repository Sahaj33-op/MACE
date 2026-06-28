package utils

import (
	"fmt"
	"net"
)

// IsTCPPortAvailable checks if a TCP port is available to listen on.
func IsTCPPortAvailable(port int) bool {
	ln, err := net.Listen("tcp", fmt.Sprintf(":%d", port))
	if err != nil {
		return false
	}
	ln.Close()
	return true
}

// IsUDPPortAvailable checks if a UDP port is available to listen on.
func IsUDPPortAvailable(port int) bool {
	addr, err := net.ResolveUDPAddr("udp", fmt.Sprintf(":%d", port))
	if err != nil {
		return false
	}
	ln, err := net.ListenUDP("udp", addr)
	if err != nil {
		return false
	}
	ln.Close()
	return true
}
