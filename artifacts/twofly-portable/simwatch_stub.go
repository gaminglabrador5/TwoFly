//go:build !windows

package main

func startSimLoop() {}

func simStatusJSON() []byte {
	return []byte(`{"connected":false}`)
}

func simReset() {}
