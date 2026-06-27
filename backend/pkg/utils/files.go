package utils

import (
	"io"
	"os"
	"path/filepath"
)

// EnsureDir checks if a directory exists, and creates it if not.
func EnsureDir(path string) error {
	if _, err := os.Stat(path); os.IsNotExist(err) {
		return os.MkdirAll(path, 0755)
	}
	return nil
}

// FileExists returns true if a file exists and is not a directory.
func FileExists(path string) bool {
	info, err := os.Stat(path)
	if os.IsNotExist(err) {
		return false
	}
	return !info.IsDir()
}

// CopyFile copies a file from source to dest.
func CopyFile(src, dst string) error {
	in, err := os.Open(src)
	if err != nil {
		return err
	}
	defer in.Close()

	if err := EnsureDir(filepath.Dir(dst)); err != nil {
		return err
	}

	out, err := os.Create(dst)
	if err != nil {
		return err
	}
	defer out.Close()

	_, err = io.Copy(out, in)
	if err != nil {
		return err
	}
	return out.Sync()
}

// GetServerRoot resolves the root servers directory dynamically.
func GetServerRoot() string {
	if s, err := LoadSettings(); err == nil && s.ServersDir != "" {
		EnsureDir(s.ServersDir)
		abs, _ := filepath.Abs(s.ServersDir)
		return abs
	}

	if _, err := os.Stat("servers"); err == nil {
		abs, _ := filepath.Abs("servers")
		return abs
	}
	if _, err := os.Stat("../servers"); err == nil {
		abs, _ := filepath.Abs("../servers")
		return abs
	}
	if _, err := os.Stat("../../../servers"); err == nil {
		abs, _ := filepath.Abs("../../../servers")
		return abs
	}
	cwd, _ := os.Getwd()
	if filepath.Base(cwd) == "backend" || filepath.Base(cwd) == "cmd" || filepath.Base(cwd) == "mace" {
		dir := filepath.Join(cwd, "..", "servers")
		if filepath.Base(cwd) == "mace" {
			dir = filepath.Join(cwd, "..", "..", "..", "servers")
		}
		EnsureDir(dir)
		abs, _ := filepath.Abs(dir)
		return abs
	}
	dir := "./servers"
	EnsureDir(dir)
	abs, _ := filepath.Abs(dir)
	return abs
}

// CopyDir recursively copies a directory tree from src to dst.
func CopyDir(src, dst string) error {
	srcInfo, err := os.Stat(src)
	if err != nil {
		return err
	}

	if err := os.MkdirAll(dst, srcInfo.Mode()); err != nil {
		return err
	}

	directory, err := os.Open(src)
	if err != nil {
		return err
	}
	defer directory.Close()

	objects, err := directory.Readdir(-1)
	if err != nil {
		return err
	}

	for _, obj := range objects {
		srcFile := filepath.Join(src, obj.Name())
		dstFile := filepath.Join(dst, obj.Name())

		if obj.IsDir() {
			if err := CopyDir(srcFile, dstFile); err != nil {
				return err
			}
		} else {
			if err := CopyFile(srcFile, dstFile); err != nil {
				return err
			}
		}
	}
	return nil
}

