package main

import (
	"embed"
	"encoding/json"
	"fmt"
	"io"
	"io/fs"
	"net"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync/atomic"
	"syscall"
	"time"
	"unsafe"
)

//go:embed all:web
var webFS embed.FS

const deskAddr = "127.0.0.1:17824"

func dataDir() string {
	base := os.Getenv("LOCALAPPDATA")
	if base == "" {
		base = os.TempDir()
	}
	dir := filepath.Join(base, "TwoFly")
	_ = os.MkdirAll(dir, 0755)
	return dir
}

func logPath() string {
	return filepath.Join(dataDir(), "twofly.log")
}

func storePath() string {
	return filepath.Join(dataDir(), "store.json")
}

func logf(format string, args ...any) {
	f, err := os.OpenFile(logPath(), os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0644)
	if err != nil {
		return
	}
	defer f.Close()
	fmt.Fprintf(f, "%s "+format+"\n", append([]any{time.Now().Format(time.RFC3339)}, args...)...)
}

func alert(title, text string) {
	t, _ := syscall.UTF16PtrFromString(title)
	m, _ := syscall.UTF16PtrFromString(text)
	user32 := syscall.NewLazyDLL("user32.dll")
	proc := user32.NewProc("MessageBoxW")
	proc.Call(0, uintptr(unsafe.Pointer(m)), uintptr(unsafe.Pointer(t)), 0x10)
}

func exeDir() string {
	p, err := os.Executable()
	if err != nil {
		return "."
	}
	if r, err := filepath.EvalSymlinks(p); err == nil {
		p = r
	}
	return filepath.Dir(p)
}

func sidecarDir(name string) string {
	dir := filepath.Join(exeDir(), name)
	if fi, err := os.Stat(dir); err != nil || !fi.IsDir() {
		logf("no sidecar %s folder", name)
		return ""
	}
	logf("sidecar %s: %s", name, dir)
	return dir
}

func browserCandidates() []string {
	pf := os.Getenv("ProgramFiles")
	pfx := os.Getenv("ProgramFiles(x86)")
	local := os.Getenv("LOCALAPPDATA")
	return []string{
		filepath.Join(pfx, `Microsoft\Edge\Application\msedge.exe`),
		filepath.Join(pf, `Microsoft\Edge\Application\msedge.exe`),
		filepath.Join(pf, `Google\Chrome\Application\chrome.exe`),
		filepath.Join(local, `Google\Chrome\Application\chrome.exe`),
		filepath.Join(local, `Microsoft\Edge\Application\msedge.exe`),
	}
}

func openDesk(url string) error {
	profile := filepath.Join(os.Getenv("LOCALAPPDATA"), "TwoFly", "profile")
	_ = os.MkdirAll(profile, 0755)
	args := []string{
		"--app=" + url,
		"--user-data-dir=" + profile,
		"--no-first-run",
		"--no-default-browser-check",
		"--disable-features=Translate",
	}
	for _, bin := range browserCandidates() {
		if _, err := os.Stat(bin); err != nil {
			continue
		}
		logf("launch %s", bin)
		cmd := exec.Command(bin, args...)
		cmd.Dir = profile
		if err := cmd.Start(); err != nil {
			logf("start failed: %v", err)
			continue
		}
		go func() { _ = cmd.Wait() }()
		return nil
	}
	logf("no chrome/edge found, using default handler")
	return exec.Command("rundll32", "url.dll,FileProtocolHandler", url).Start()
}

func sidecarHandler(disks map[string]string, embedRoot fs.FS) http.Handler {
	embed := http.FileServer(http.FS(embedRoot))
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		for prefix, root := range disks {
			if root == "" {
				continue
			}
			p := "/" + prefix + "/"
			if !strings.HasPrefix(r.URL.Path, p) {
				continue
			}
			rel := strings.TrimPrefix(r.URL.Path, p)
			rel = filepath.FromSlash(pathClean(rel))
			full := filepath.Join(root, rel)
			if inDir(root, full) {
				if fi, err := os.Stat(full); err == nil && !fi.IsDir() {
					w.Header().Set("Cache-Control", "no-store")
					http.ServeFile(w, r, full)
					return
				}
			}
		}
		embed.ServeHTTP(w, r)
	})
}

func pathClean(rel string) string {
	rel = strings.TrimPrefix(rel, "/")
	rel = filepath.ToSlash(rel)
	clean := pathCleanSlash(rel)
	return strings.TrimPrefix(clean, "/")
}

func pathCleanSlash(p string) string {
	parts := strings.Split(p, "/")
	out := make([]string, 0, len(parts))
	for _, part := range parts {
		if part == "" || part == "." {
			continue
		}
		if part == ".." {
			if len(out) > 0 {
				out = out[:len(out)-1]
			}
			continue
		}
		out = append(out, part)
	}
	return strings.Join(out, "/")
}

func inDir(root, candidate string) bool {
	root, _ = filepath.Abs(root)
	candidate, _ = filepath.Abs(candidate)
	rel, err := filepath.Rel(root, candidate)
	if err != nil {
		return false
	}
	return rel != ".." && !strings.HasPrefix(rel, ".."+string(os.PathSeparator))
}

func waitReady(url string) bool {
	deadline := time.Now().Add(3 * time.Second)
	client := &http.Client{Timeout: 200 * time.Millisecond}
	for time.Now().Before(deadline) {
		resp, err := client.Get(url)
		if err == nil {
			resp.Body.Close()
			return true
		}
		time.Sleep(40 * time.Millisecond)
	}
	return false
}

func main() {
	root, err := fs.Sub(webFS, "web")
	if err != nil {
		logf("embed: %v", err)
		alert("TwoFly", "Dispatch files missing.")
		return
	}
	diskStamps := sidecarDir("stamps")
	diskPilots := sidecarDir("pilots")
	ln, err := net.Listen("tcp", deskAddr)
	if err != nil {
		url := "http://" + deskAddr + "/"
		logf("listen: %v — opening existing desk %s", err, url)
		if openErr := openDesk(url); openErr != nil {
			alert("TwoFly", "Could not start the local desk.\n"+err.Error())
		}
		return
	}
	url := "http://" + deskAddr + "/"
	logf("serve %s", url)

	var lastPing atomic.Int64
	mux := http.NewServeMux()
	mux.HandleFunc("/__twofly/ping", func(w http.ResponseWriter, r *http.Request) {
		lastPing.Store(time.Now().Unix())
		w.Header().Set("Cache-Control", "no-store")
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.WriteHeader(204)
	})
	mux.HandleFunc("/__twofly/store", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-store")
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, PUT, POST, OPTIONS")
		if r.Method == http.MethodOptions {
			w.WriteHeader(204)
			return
		}
		switch r.Method {
		case http.MethodGet:
			b, err := os.ReadFile(storePath())
			if err != nil || len(b) == 0 {
				w.Header().Set("Content-Type", "application/json")
				w.Write([]byte("{}"))
				return
			}
			w.Header().Set("Content-Type", "application/json")
			w.Write(b)
		case http.MethodPut, http.MethodPost:
			body, err := io.ReadAll(io.LimitReader(r.Body, 8<<20))
			if err != nil || !json.Valid(body) {
				http.Error(w, "bad store", 400)
				return
			}
			tmp := storePath() + ".tmp"
			if err := os.WriteFile(tmp, body, 0600); err != nil {
				http.Error(w, "write", 500)
				return
			}
			if err := os.Rename(tmp, storePath()); err != nil {
				http.Error(w, "write", 500)
				return
			}
			w.WriteHeader(204)
		default:
			w.WriteHeader(405)
		}
	})
	mux.Handle("/", sidecarHandler(map[string]string{
		"stamps": diskStamps,
		"pilots": diskPilots,
	}, root))
	go func() {
		if err := http.Serve(ln, mux); err != nil {
			logf("serve: %v", err)
		}
	}()
	if !waitReady(url) {
		logf("server not ready")
		alert("TwoFly", "Local desk did not start.")
		return
	}
	if err := openDesk(url); err != nil {
		logf("open: %v", err)
		alert("TwoFly", "Install Microsoft Edge or Google Chrome, then try again.")
		return
	}

	// Stay alive until the window stops pinging. Edge/Chrome often exits the
	// launcher process immediately; do not treat that as "window closed".
	firstDeadline := time.Now().Add(60 * time.Second)
	for {
		time.Sleep(1 * time.Second)
		ping := lastPing.Load()
		if ping == 0 {
			if time.Now().After(firstDeadline) {
				logf("no window ping")
				return
			}
			continue
		}
		if time.Now().Unix()-ping > 12 {
			logf("window gone")
			return
		}
	}
}
