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
	"path/filepath"
	"strings"
	"syscall"
	"time"
	"unsafe"

	webview2 "github.com/jchv/go-webview2"
)

//go:embed all:web
var webFS embed.FS

const appVersion = "1.5.0"
const appBuild = "20260919g"

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

func sidecarHandler(disks map[string]string, embedRoot fs.FS) http.Handler {
	embed := http.FileServer(http.FS(embedRoot))
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-store, no-cache, must-revalidate")
		w.Header().Set("Pragma", "no-cache")
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

func openWindow(url string) {
	wvDir := filepath.Join(dataDir(), "wv2")
	_ = os.MkdirAll(wvDir, 0755)
	w := webview2.NewWithOptions(webview2.WebViewOptions{
		Debug:     false,
		DataPath:  wvDir,
		AutoFocus: true,
		WindowOptions: webview2.WindowOptions{
			Title:  "TwoFly",
			Width:  1280,
			Height: 840,
			IconId: 1,
			Center: true,
		},
	})
	if w == nil {
		logf("webview2 failed to create window")
		alert("TwoFly", "Microsoft WebView2 Runtime is required.\nInstall it from Microsoft, then run TwoFly again.\nhttps://go.microsoft.com/fwlink/p/?LinkId=2124703")
		return
	}
	defer w.Destroy()
	w.SetSize(960, 640, webview2.HintMin)
	w.SetSize(1280, 840, webview2.HintNone)
	w.Navigate(url)
	logf("webview2 %s", url)
	w.Run()
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
	var ln net.Listener
	var addr string
	var errListen error
	for p := 17824; p <= 17834; p++ {
		try := fmt.Sprintf("127.0.0.1:%d", p)
		ln, errListen = net.Listen("tcp", try)
		if errListen == nil {
			addr = try
			break
		}
		logf("listen %s: %v", try, errListen)
	}
	if ln == nil {
		alert("TwoFly", "Could not start the local desk.\nClose other TwoFly windows, then try again.")
		return
	}
	url := "http://" + addr + "/"
	logf("serve %s", url)

	mux := http.NewServeMux()
	mux.HandleFunc("/__twofly/ping", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-store")
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.WriteHeader(204)
	})
	mux.HandleFunc("/__twofly/version", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-store")
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprintf(w, `{"app":"TwoFly","version":"%s","build":"%s","addr":"%s"}`, appVersion, appBuild, addr)
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
	openWindow(url)
}
