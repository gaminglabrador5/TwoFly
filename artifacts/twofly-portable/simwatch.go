//go:build windows

package main

import (
	"encoding/json"
	"fmt"
	"math"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"syscall"
	"time"
	"unsafe"
)

type simSnap struct {
	Connected bool    `json:"connected"`
	Airborne  bool    `json:"airborne"`
	OnGround  bool    `json:"onGround"`
	Landed    bool    `json:"landed"`
	LandAt    string  `json:"landAt,omitempty"`
	Crashed   bool    `json:"crashed"`
	Overbank  bool    `json:"overbank"`
	MaxBank   float64 `json:"maxBank"`
	Bank      float64 `json:"bank"`
	TouchFpm  float64 `json:"touchFpm"`
	HasFpm    bool    `json:"hasFpm"`
	TouchIas  float64 `json:"touchIas"`
	TouchG    float64 `json:"touchG"`
	Bounce    bool    `json:"bounce"`
	GoAround  bool    `json:"goAround"`
	MaxG      float64 `json:"maxG"`
	MaxIas    float64 `json:"maxIas"`
	MinVs     float64 `json:"minVs"`
	PeakG     float64 `json:"peakG"`
	CrashWhy  string  `json:"crashWhy,omitempty"`
	LandLat   float64 `json:"landLat"`
	LandLon   float64 `json:"landLon"`
	HasPos    bool    `json:"hasPos"`
	AtcID     string  `json:"atcId,omitempty"`
	Callsign  string  `json:"callsign,omitempty"`
	Err       string  `json:"err,omitempty"`
}

var (
	simMu    sync.Mutex
	simCur   simSnap
	simEpoch int
	simDLL   *syscall.LazyDLL
	simProc  struct {
		open, close, addDef, req, sub, next *syscall.LazyProc
	}
)

const (
	scObjectUser        = 0
	scPeriodNever       = 0
	scPeriodOnce        = 1
	scPeriodVisualFrame = 2
	scPeriodSimFrame    = 3
	scPeriodSecond      = 4
	scFloat64           = 4
	scString8           = 5
	scString32          = 6
	scString64          = 7
	scUnused            = 0xFFFFFFFF
	recvException       = 1
	recvOpen            = 2
	recvQuit            = 3
	recvEvent           = 4
	recvSimObject       = 8
	evtCrash            = 1
	evtCrashReset       = 2
	defID               = 1
	reqID               = 1
	defStr              = 2
	reqStr              = 2
)

func simStatusJSON() []byte {
	simMu.Lock()
	defer simMu.Unlock()
	b, _ := json.Marshal(simCur)
	return b
}

func simReset() {
	simMu.Lock()
	defer simMu.Unlock()
	simCur.Airborne = false
	simCur.OnGround = false
	simCur.Landed = false
	simCur.LandAt = ""
	simCur.Crashed = false
	simCur.Overbank = false
	simCur.MaxBank = 0
	simCur.Bank = 0
	simCur.TouchFpm = 0
	simCur.HasFpm = false
	simCur.TouchIas = 0
	simCur.TouchG = 0
	simCur.Bounce = false
	simCur.GoAround = false
	simCur.MaxG = 0
	simCur.MaxIas = 0
	simCur.MinVs = 0
	simCur.PeakG = 0
	simCur.CrashWhy = ""
	simCur.LandLat = 0
	simCur.LandLon = 0
	simCur.HasPos = false
	simEpoch++
}

func setSimErr(s string) {
	simMu.Lock()
	simCur.Err = s
	simMu.Unlock()
	logf("sim: %s", s)
}

func startSimLoop() {
	go func() {
		for {
			if err := simSession(); err != nil {
				setSimErr(err.Error())
			}
			simMu.Lock()
			simCur.Connected = false
			simMu.Unlock()
			time.Sleep(3 * time.Second)
		}
	}()
}

func findSimConnect() string {
	if p := os.Getenv("SIMCONNECT_DLL"); p != "" {
		if _, err := os.Stat(p); err == nil {
			return p
		}
	}
	exe, _ := os.Executable()
	dir := filepath.Dir(exe)
	local := os.Getenv("LOCALAPPDATA")
	pf := os.Getenv("ProgramFiles")
	pfx := os.Getenv("ProgramFiles(x86)")
	sdk := os.Getenv("MSFS_SDK")
	cands := []string{
		filepath.Join(dir, "SimConnect.dll"),
		filepath.Join(sdk, `SimConnect SDK\lib\x64\SimConnect.dll`),
		filepath.Join(sdk, `SimConnect SDK\lib\SimConnect.dll`),
		`C:\MSFS 2024 SDK\SimConnect SDK\lib\x64\SimConnect.dll`,
		`C:\MSFS SDK\SimConnect SDK\lib\x64\SimConnect.dll`,
		`C:\MSFS 2020 SDK\SimConnect SDK\lib\x64\SimConnect.dll`,
		filepath.Join(pf, `Windows Kits\10\Lib\10.0.26100.0\um\x64\SimConnect.dll`),
		filepath.Join(pfx, `Steam\steamapps\common\Microsoft Flight Simulator 2024\SimConnect.dll`),
		filepath.Join(local, `Packages\Microsoft.Limitless_8wekyb3d8bbwe\LocalCache\SimConnect.dll`),
		filepath.Join(local, `Packages\Microsoft.FlightSimulator_8wekyb3d8bbwe\LocalCache\SimConnect.dll`),
	}
	for _, p := range cands {
		if p == "" {
			continue
		}
		if _, err := os.Stat(p); err == nil {
			return p
		}
	}
	return "SimConnect.dll"
}

func loadSimDLL() error {
	if simDLL != nil {
		return nil
	}
	path := findSimConnect()
	logf("sim: dll %s", path)
	d := syscall.NewLazyDLL(path)
	if err := d.Load(); err != nil {
		return err
	}
	simDLL = d
	simProc.open = d.NewProc("SimConnect_Open")
	simProc.close = d.NewProc("SimConnect_Close")
	simProc.addDef = d.NewProc("SimConnect_AddToDataDefinition")
	simProc.req = d.NewProc("SimConnect_RequestDataOnSimObject")
	simProc.sub = d.NewProc("SimConnect_SubscribeToSystemEvent")
	simProc.next = d.NewProc("SimConnect_GetNextDispatch")
	return nil
}

func scCall(p *syscall.LazyProc, a ...uintptr) uintptr {
	r, _, _ := p.Call(a...)
	return r
}

func cstr(s string) uintptr {
	b, err := syscall.BytePtrFromString(s)
	if err != nil {
		return 0
	}
	return uintptr(unsafe.Pointer(b))
}

func u32(ptr uintptr, off uintptr) uint32 {
	return *(*uint32)(unsafe.Pointer(ptr + off))
}

func f64(ptr uintptr, off uintptr) float64 {
	return *(*float64)(unsafe.Pointer(ptr + off))
}

func simSession() error {
	if err := loadSimDLL(); err != nil {
		return err
	}
	var h uintptr
	name := cstr("TwoFly")
	if r := scCall(simProc.open, uintptr(unsafe.Pointer(&h)), name, 0, 0, 0, 0); r != 0 || h == 0 {
		return errSim("open failed — is MSFS running?")
	}
	defer scCall(simProc.close, h)

	type numVar struct {
		name   string
		unit   string
		bank   bool // value is radians; convert to degrees
		gforce bool
		vs     bool
		pos    bool
	}
	want := []numVar{
		{name: "SIM ON GROUND", unit: "Bool"},
		{name: "PLANE BANK DEGREES", unit: "Degrees", bank: true},
		{name: "AIRSPEED INDICATED", unit: "Knots"},
		{name: "PLANE ALT ABOVE GROUND", unit: "Feet"},
		{name: "VERTICAL SPEED", unit: "Feet per minute", vs: true},
		{name: "G FORCE", unit: "GForce", gforce: true},
		{name: "PLANE LATITUDE", unit: "Degrees", pos: true},
		{name: "PLANE LONGITUDE", unit: "Degrees", pos: true},
	}
	var nums []numVar
	for _, v := range want {
		r := scCall(simProc.addDef, h, defID, cstr(v.name), cstr(v.unit), scFloat64, 0, scUnused)
		if r != 0 && v.bank {
			v.bank = true
			v.unit = "Radians"
			r = scCall(simProc.addDef, h, defID, cstr(v.name), cstr(v.unit), scFloat64, 0, scUnused)
		}
		if r != 0 && v.gforce {
			v.unit = "Number"
			r = scCall(simProc.addDef, h, defID, cstr(v.name), cstr(v.unit), scFloat64, 0, scUnused)
		}
		if r != 0 && v.vs {
			v.unit = "Feet per second"
			r = scCall(simProc.addDef, h, defID, cstr(v.name), cstr(v.unit), scFloat64, 0, scUnused)
		}
		if r != 0 && v.pos {
			v.unit = "Radians"
			r = scCall(simProc.addDef, h, defID, cstr(v.name), cstr(v.unit), scFloat64, 0, scUnused)
		}
		if r != 0 {
			logf("sim: add %s failed %d", v.name, r)
			continue
		}
		nums = append(nums, v)
	}
	if len(nums) == 0 {
		return errSim("no simvars accepted")
	}
	if r := scCall(simProc.req, h, reqID, defID, scObjectUser, scPeriodSimFrame, 0, 0, 0, 0); r != 0 {
		logf("sim: request period sim-frame failed %d, trying second", r)
		if r2 := scCall(simProc.req, h, reqID, defID, scObjectUser, scPeriodSecond, 0, 0, 0, 0); r2 != 0 {
			return errSim("data request failed")
		}
	}
	strBytes := 0
	strCount := 0
	for _, opt := range []struct {
		kind uintptr
		n    int
	}{{scString32, 32}, {scString64, 64}, {scString8, 8}} {
		if r := scCall(simProc.addDef, h, defStr, cstr("ATC ID"), cstr("String"), opt.kind, 0, scUnused); r == 0 {
			strBytes = opt.n
			strCount = 1
			if r2 := scCall(simProc.addDef, h, defStr, cstr("ATC FLIGHT NUMBER"), cstr("String"), opt.kind, 0, scUnused); r2 == 0 {
				strCount = 2
			} else {
				logf("sim: ATC FLIGHT NUMBER not accepted %d", r2)
			}
			break
		}
	}
	if strBytes > 0 {
		if r := scCall(simProc.req, h, reqStr, defStr, scObjectUser, scPeriodSecond, 0, 0, 0, 0); r != 0 {
			logf("sim: atc id request failed %d", r)
			strBytes = 0
		}
	} else {
		logf("sim: ATC ID not accepted")
	}
	if r := scCall(simProc.sub, h, evtCrash, cstr("Crashed")); r != 0 {
		logf("sim: subscribe Crashed failed %d", r)
	}
	if r := scCall(simProc.sub, h, evtCrashReset, cstr("CrashReset")); r != 0 {
		logf("sim: subscribe CrashReset failed %d", r)
	}

	simMu.Lock()
	simCur.Connected = true
	simCur.Err = ""
	simMu.Unlock()
	logf("sim: connected (%d vars, tail %d)", len(nums), strBytes)

	wasAir := false
	flareVS := 0.0
	flareSeen := false
	approachVS := 0.0
	approachSeen := false
	lowArmed := false
	wentAround := false
	sortieMaxG := 0.0
	sortieMaxIas := 0.0
	bounceAir := false
	var bounceUntil time.Time
	epoch := 0
	packets := 0
	deadline := time.Now().Add(24 * time.Hour)
	for time.Now().Before(deadline) {
		var ptr uintptr
		var n uint32
		r := scCall(simProc.next, h, uintptr(unsafe.Pointer(&ptr)), uintptr(unsafe.Pointer(&n)))
		if r != 0 || ptr == 0 || n < 12 {
			time.Sleep(50 * time.Millisecond)
			continue
		}
		id := u32(ptr, 8)
		switch id {
		case recvQuit:
			return errSim("sim quit")
		case recvException:
			logf("sim: exception dwException=%d", u32(ptr, 12))
		case recvEvent:
			ev := uint32(0)
			if n >= 20 {
				ev = u32(ptr, 16)
			}
			if ev == evtCrash {
				simMu.Lock()
				if !simCur.Crashed {
					simCur.Crashed = true
					simCur.CrashWhy = "simulator crash event"
				}
				simMu.Unlock()
				logf("sim: crash event")
			} else if ev == evtCrashReset {
				logf("sim: crash reset (not counted as a crash)")
			}
		case recvSimObject:
			if n < 40 {
				continue
			}
			def := u32(ptr, 20)
			if def == defStr && strBytes > 0 {
				need := 40 + uint32(strBytes*strCount)
				if n < need {
					continue
				}
				tail := cleanTail(cString(ptr+40, strBytes))
				call := ""
				if strCount > 1 {
					call = cleanCall(cString(ptr+40+uintptr(strBytes), strBytes))
					if call == tail {
						call = ""
					}
				}
				simMu.Lock()
				simCur.AtcID = tail
				simCur.Callsign = call
				simMu.Unlock()
				continue
			}
			count := int(u32(ptr, 36))
			if count <= 0 || n < 40+uint32(count)*8 {
				continue
			}
			base := ptr + 40
			onGnd, bank, ias, agl, vs, g := 1.0, 0.0, 0.0, 0.0, 0.0, 0.0
			plat, plon := math.NaN(), math.NaN()
			for i := 0; i < count && i < len(nums); i++ {
				val := f64(base, uintptr(i)*8)
				nv := nums[i]
				switch {
				case nv.name == "SIM ON GROUND":
					onGnd = val
				case nv.bank:
					if nv.unit == "Radians" {
						val = val * 180 / math.Pi
					}
					bank = val
				case nv.vs:
					if nv.unit == "Feet per second" {
						val *= 60
					}
					vs = val
				case nv.gforce:
					g = val
				case nv.name == "AIRSPEED INDICATED":
					ias = val
				case nv.name == "PLANE ALT ABOVE GROUND":
					agl = val
				case nv.name == "PLANE LATITUDE":
					if nv.unit == "Radians" {
						val = val * 180 / math.Pi
					}
					plat = val
				case nv.name == "PLANE LONGITUDE":
					if nv.unit == "Radians" {
						val = val * 180 / math.Pi
					}
					plon = val
				}
			}
			absBank := math.Abs(bank)
			air := onGnd < 0.5 && (ias > 12 || agl > 20)
			packets++
			if packets == 1 || packets%300 == 0 {
				logf("sim: gnd=%.0f bank=%.0f ias=%.0f agl=%.0f vs=%.0f g=%.1f tail=%s", onGnd, bank, ias, agl, vs, g, simCur.AtcID)
			}
			simMu.Lock()
			if epoch != simEpoch {
				epoch = simEpoch
				wasAir = false
				flareVS = 0
				flareSeen = false
				approachVS = 0
				approachSeen = false
				lowArmed = false
				wentAround = false
				sortieMaxG = 0
				sortieMaxIas = 0
				bounceAir = false
				bounceUntil = time.Time{}
			}
			simCur.Bank = math.Round(absBank*10) / 10
			simCur.OnGround = onGnd >= 0.5
			if absBank > simCur.MaxBank {
				simCur.MaxBank = simCur.Bank
			}
			if absBank >= 70 {
				simCur.Overbank = true
			}
			if ias > sortieMaxIas {
				sortieMaxIas = ias
			}
			if g > sortieMaxG {
				sortieMaxG = g
			}
			if air && vs < simCur.MinVs {
				simCur.MinVs = math.Round(vs)
			}
			if air && g > simCur.PeakG {
				simCur.PeakG = math.Round(g*10) / 10
			}
			if air {
				wasAir = true
				simCur.Airborne = true
				if simCur.Landed && !bounceUntil.IsZero() && time.Now().Before(bounceUntil) && agl > 8 {
					bounceAir = true
				}
				if agl <= 80 && agl > 2 {
					lowArmed = true
				}
				if agl > 400 && lowArmed && !simCur.Landed {
					wentAround = true
					lowArmed = false
					logf("sim: go-around")
				}
				if agl > 180 {
					flareVS = 0
					flareSeen = false
					approachVS = 0
					approachSeen = false
				} else if agl > 2 {
					approachVS = vs
					approachSeen = true
					if agl <= 45 {
						flareVS = vs
						flareSeen = true
					}
				}
			} else {
				simCur.Airborne = false
				if wasAir && onGnd >= 0.5 {
					fpm := 0.0
					hasFpm := false
					if flareSeen {
						fpm = flareVS
						hasFpm = true
					} else if approachSeen {
						fpm = approachVS
						hasFpm = true
					}
					if hasFpm && fpm <= -2200 {
						if !simCur.Crashed {
							simCur.Crashed = true
							simCur.CrashWhy = fmt.Sprintf("touchdown %.0f fpm", fpm)
						}
						logf("sim: impact fpm=%.0f", fpm)
					} else if g >= 5 && g <= 30 && hasFpm && fpm <= -800 {
						if !simCur.Crashed {
							simCur.Crashed = true
							simCur.CrashWhy = fmt.Sprintf("touchdown %.1f g at %.0f fpm", g, fpm)
						}
						logf("sim: impact g=%.1f fpm=%.0f", g, fpm)
					}
					if !simCur.Landed {
						simCur.Landed = true
						simCur.LandAt = time.Now().UTC().Format(time.RFC3339)
						simCur.TouchFpm = math.Round(fpm)
						simCur.HasFpm = hasFpm
						simCur.TouchIas = math.Round(ias)
						simCur.TouchG = math.Round(g*10) / 10
						simCur.GoAround = wentAround
						simCur.MaxG = math.Round(sortieMaxG*10) / 10
						simCur.MaxIas = math.Round(sortieMaxIas)
						if !math.IsNaN(plat) && !math.IsNaN(plon) && !(plat == 0 && plon == 0) {
							simCur.LandLat = math.Round(plat*1e5) / 1e5
							simCur.LandLon = math.Round(plon*1e5) / 1e5
							simCur.HasPos = true
						}
						bounceUntil = time.Now().Add(12 * time.Second)
						logf("sim: touchdown fpm=%.0f ias=%.0f g=%.1f around=%v pos=%.3f,%.3f", fpm, ias, g, wentAround, plat, plon)
					} else if bounceAir {
						simCur.Bounce = true
						if hasFpm && fpm < simCur.TouchFpm {
							simCur.TouchFpm = math.Round(fpm)
							simCur.HasFpm = true
						}
						bounceAir = false
						logf("sim: bounce fpm=%.0f", fpm)
					}
					wasAir = false
					flareVS = 0
					flareSeen = false
					approachVS = 0
					approachSeen = false
					lowArmed = false
				}
			}
			simMu.Unlock()
		}
	}
	return nil
}

func cString(ptr uintptr, n int) string {
	if ptr == 0 || n <= 0 {
		return ""
	}
	b := unsafe.Slice((*byte)(unsafe.Pointer(ptr)), n)
	for i, c := range b {
		if c == 0 {
			return string(b[:i])
		}
	}
	return string(b)
}

func cleanCall(s string) string {
	s = strings.ToUpper(strings.TrimSpace(s))
	out := make([]byte, 0, len(s))
	prevSpace := false
	for i := 0; i < len(s) && len(out) < 12; i++ {
		c := s[i]
		if (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9') {
			out = append(out, c)
			prevSpace = false
			continue
		}
		if (c == ' ' || c == '-') && len(out) > 0 && !prevSpace {
			out = append(out, ' ')
			prevSpace = true
		}
	}
	return strings.TrimSpace(string(out))
}

func cleanTail(s string) string {
	s = strings.ToUpper(strings.TrimSpace(s))
	out := make([]byte, 0, len(s))
	for i := 0; i < len(s) && len(out) < 12; i++ {
		c := s[i]
		if (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9') || c == '-' {
			out = append(out, c)
		}
	}
	return string(out)
}

type simErr string

func (e simErr) Error() string { return string(e) }
func errSim(s string) error    { return simErr("sim " + s) }
