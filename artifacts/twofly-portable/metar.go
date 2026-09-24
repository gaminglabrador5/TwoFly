package main

import (
	"io"
	"net/http"
	"strings"
	"sync"
	"time"
)

type metarHit struct {
	body string
	at   time.Time
}

var (
	metarMu  sync.Mutex
	metarMem = map[string]metarHit{}
)

func handleMetar(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	id := strings.ToUpper(strings.TrimSpace(r.URL.Query().Get("id")))
	if len(id) < 3 || len(id) > 4 {
		http.Error(w, "id", 400)
		return
	}
	fresh := r.URL.Query().Get("fresh") == "1"
	if !fresh {
		metarMu.Lock()
		hit, ok := metarMem[id]
		metarMu.Unlock()
		if ok && time.Since(hit.at) < 12*time.Hour && hit.body != "" {
			w.Header().Set("Content-Type", "text/plain; charset=utf-8")
			w.Header().Set("Cache-Control", "no-store")
			w.Write([]byte(hit.body))
			return
		}
	}
	urls := []string{
		"https://metar.vatsim.net/" + id,
		"https://aviationweather.gov/api/data/metar?ids=" + id + "&format=raw&hours=24",
	}
	type got struct {
		body string
		rank int
	}
	ch := make(chan got, len(urls))
	client := &http.Client{Timeout: 5 * time.Second}
	var wg sync.WaitGroup
	for i, u := range urls {
		wg.Add(1)
		go func(rank int, u string) {
			defer wg.Done()
			req, err := http.NewRequest(http.MethodGet, u, nil)
			if err != nil {
				return
			}
			req.Header.Set("User-Agent", "TwoFly/"+appVersion)
			resp, err := client.Do(req)
			if err != nil {
				return
			}
			body, _ := io.ReadAll(io.LimitReader(resp.Body, 1<<16))
			resp.Body.Close()
			if resp.StatusCode != 200 {
				return
			}
			t := strings.TrimSpace(string(body))
			if t == "" || strings.Contains(strings.ToUpper(t), "NO METAR") {
				return
			}
			ch <- got{body: t, rank: rank}
		}(i, u)
	}
	go func() {
		wg.Wait()
		close(ch)
	}()
	best := ""
	bestRank := 99
	for g := range ch {
		if best == "" || g.rank < bestRank {
			best = g.body
			bestRank = g.rank
		}
	}
	if best == "" {
		http.NotFound(w, r)
		return
	}
	metarMu.Lock()
	metarMem[id] = metarHit{body: best, at: time.Now()}
	metarMu.Unlock()
	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	w.Write([]byte(best))
}
