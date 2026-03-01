// Copyright 2025, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

package conncontroller

import (
	"context"
	"errors"
	"fmt"
	"io"
	"log"
	"net"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/sanshao85/tideterm/pkg/util/utilfn"
	"github.com/sanshao85/tideterm/pkg/wconfig"
	"github.com/sanshao85/tideterm/pkg/wshrpc"
)

const (
	portForwardStatusRunning  = "running"
	portForwardStatusStopped  = "stopped"
	portForwardStatusError    = "error"
	connPortForwardsConfigKey = "conn:portforwards"
)

type managedPortForward struct {
	ID          string
	LocalHost   string
	LocalPort   int
	RemoteHost  string
	RemotePort  int
	AutoRestore bool
	CreatedAt   int64
	Status      string
	LastError   string
	Listener    net.Listener
}

func newPortForwardID() (string, error) {
	idSuffix, err := utilfn.RandomHexString(8)
	if err != nil {
		return "", fmt.Errorf("unable to generate port forward id: %w", err)
	}
	return "pf-" + idSuffix, nil
}

func toConnPortForward(pf *managedPortForward) wconfig.ConnPortForward {
	return wconfig.ConnPortForward{
		ID:          pf.ID,
		LocalHost:   pf.LocalHost,
		LocalPort:   pf.LocalPort,
		RemoteHost:  pf.RemoteHost,
		RemotePort:  pf.RemotePort,
		AutoRestore: pf.AutoRestore,
		CreatedAt:   pf.CreatedAt,
	}
}

func (conn *SSHConn) snapshotConnPortForwards() []wconfig.ConnPortForward {
	conn.Lock.Lock()
	defer conn.Lock.Unlock()
	if len(conn.PortForwards) == 0 {
		return []wconfig.ConnPortForward{}
	}
	rtn := make([]wconfig.ConnPortForward, 0, len(conn.PortForwards))
	for _, pf := range conn.PortForwards {
		rtn = append(rtn, toConnPortForward(pf))
	}
	sort.Slice(rtn, func(i, j int) bool {
		if rtn[i].CreatedAt == rtn[j].CreatedAt {
			return rtn[i].ID < rtn[j].ID
		}
		return rtn[i].CreatedAt < rtn[j].CreatedAt
	})
	return rtn
}

func (conn *SSHConn) persistPortForwards(ctx context.Context) {
	meta := map[string]any{
		connPortForwardsConfigKey: conn.snapshotConnPortForwards(),
	}
	if err := wconfig.SetConnectionsConfigValue(conn.GetName(), meta); err != nil {
		conn.Infof(ctx, "WARN could not persist conn:portforwards to connections.json: %v\n", err)
	}
}

func (conn *SSHConn) loadPersistedPortForwards(ctx context.Context) {
	if WithLockRtn(conn, func() bool { return len(conn.PortForwards) > 0 }) {
		return
	}
	connConfig, ok := conn.getConnectionConfig()
	if !ok || len(connConfig.ConnPortForwards) == 0 {
		return
	}
	nowMs := time.Now().UnixMilli()
	seenLocal := make(map[string]struct{})
	seenID := make(map[string]struct{})
	persisted := connConfig.ConnPortForwards
	loaded := make([]*managedPortForward, 0, len(persisted))
	needsPersist := false

	for idx, cfg := range persisted {
		localHost, err := normalizeLoopbackHost(cfg.LocalHost)
		if err != nil {
			conn.Infof(ctx, "WARN dropping invalid persisted port forward (%s): %v\n", cfg.ID, err)
			needsPersist = true
			continue
		}
		if cfg.LocalHost != localHost {
			needsPersist = true
		}
		if err := validateTCPPort(cfg.LocalPort, "local port"); err != nil {
			conn.Infof(ctx, "WARN dropping invalid persisted port forward (%s): %v\n", cfg.ID, err)
			needsPersist = true
			continue
		}
		remoteHost := normalizeRemoteHost(cfg.RemoteHost)
		if cfg.RemoteHost != remoteHost {
			needsPersist = true
		}
		if err := validateTCPPort(cfg.RemotePort, "remote port"); err != nil {
			conn.Infof(ctx, "WARN dropping invalid persisted port forward (%s): %v\n", cfg.ID, err)
			needsPersist = true
			continue
		}
		localKey := net.JoinHostPort(localHost, strconv.Itoa(cfg.LocalPort))
		if _, exists := seenLocal[localKey]; exists {
			conn.Infof(ctx, "WARN dropping duplicate persisted local endpoint %s\n", localKey)
			needsPersist = true
			continue
		}
		id := strings.TrimSpace(cfg.ID)
		if id == "" {
			id, err = newPortForwardID()
			if err != nil {
				conn.Infof(ctx, "WARN dropping persisted port forward without id: %v\n", err)
				needsPersist = true
				continue
			}
			needsPersist = true
		}
		if _, exists := seenID[id]; exists {
			newID, genErr := newPortForwardID()
			if genErr != nil {
				conn.Infof(ctx, "WARN dropping persisted duplicated id %s: %v\n", id, genErr)
				needsPersist = true
				continue
			}
			id = newID
			needsPersist = true
		}
		createdAt := cfg.CreatedAt
		if createdAt <= 0 {
			createdAt = nowMs + int64(idx)
			needsPersist = true
		}
		seenLocal[localKey] = struct{}{}
		seenID[id] = struct{}{}
		loaded = append(loaded, &managedPortForward{
			ID:          id,
			LocalHost:   localHost,
			LocalPort:   cfg.LocalPort,
			RemoteHost:  remoteHost,
			RemotePort:  cfg.RemotePort,
			AutoRestore: cfg.AutoRestore,
			CreatedAt:   createdAt,
			Status:      portForwardStatusStopped,
		})
	}

	if len(loaded) == 0 {
		if len(persisted) > 0 {
			conn.persistPortForwards(ctx)
		}
		return
	}

	loadedCount := 0
	conn.WithLock(func() {
		if len(conn.PortForwards) > 0 {
			return
		}
		conn.PortForwards = make(map[string]*managedPortForward, len(loaded))
		for _, pf := range loaded {
			conn.PortForwards[pf.ID] = pf
		}
		loadedCount = len(loaded)
	})
	if loadedCount == 0 {
		return
	}
	conn.Infof(ctx, "loaded %d persisted port forwards from connections.json\n", loadedCount)
	if needsPersist {
		conn.persistPortForwards(ctx)
	}
}

func normalizeLoopbackHost(host string) (string, error) {
	host = strings.TrimSpace(host)
	if host == "" || strings.EqualFold(host, "localhost") {
		return "127.0.0.1", nil
	}
	ip := net.ParseIP(host)
	if ip == nil {
		return "", fmt.Errorf("invalid local host %q", host)
	}
	if !ip.IsLoopback() {
		return "", fmt.Errorf("local bind host must be loopback (127.0.0.1 or ::1)")
	}
	return host, nil
}

func normalizeRemoteHost(host string) string {
	host = strings.TrimSpace(host)
	if host == "" || strings.EqualFold(host, "localhost") {
		return "127.0.0.1"
	}
	return host
}

func validateTCPPort(port int, label string) error {
	if port < 1 || port > 65535 {
		return fmt.Errorf("%s must be between 1 and 65535", label)
	}
	return nil
}

func (conn *SSHConn) toPortForwardInfo(pf *managedPortForward) wshrpc.PortForwardInfo {
	return wshrpc.PortForwardInfo{
		Id:            pf.ID,
		ConnName:      conn.GetName(),
		LocalHost:     pf.LocalHost,
		LocalPort:     pf.LocalPort,
		LocalAddress:  net.JoinHostPort(pf.LocalHost, strconv.Itoa(pf.LocalPort)),
		RemoteHost:    pf.RemoteHost,
		RemotePort:    pf.RemotePort,
		RemoteAddress: net.JoinHostPort(pf.RemoteHost, strconv.Itoa(pf.RemotePort)),
		AutoRestore:   pf.AutoRestore,
		Status:        pf.Status,
		LastError:     pf.LastError,
		CreatedAt:     pf.CreatedAt,
	}
}

func (conn *SSHConn) hasDuplicatePortForward_nolock(localHost string, localPort int) (bool, string) {
	for _, existing := range conn.PortForwards {
		if existing.LocalHost == localHost && existing.LocalPort == localPort {
			return true, existing.ID
		}
	}
	return false, ""
}

func (conn *SSHConn) updatePortForwardError(id string, err error) {
	if err == nil {
		return
	}
	conn.WithLock(func() {
		pf := conn.PortForwards[id]
		if pf == nil {
			return
		}
		pf.LastError = err.Error()
		if pf.Status != portForwardStatusRunning {
			pf.Status = portForwardStatusError
		}
	})
}

func (conn *SSHConn) startPortForward(ctx context.Context, pf *managedPortForward) error {
	client := conn.GetClient()
	if client == nil {
		err := fmt.Errorf("ssh client is not connected")
		conn.updatePortForwardError(pf.ID, err)
		return err
	}
	listenAddr := net.JoinHostPort(pf.LocalHost, strconv.Itoa(pf.LocalPort))
	listener, err := net.Listen("tcp", listenAddr)
	if err != nil {
		conn.updatePortForwardError(pf.ID, err)
		return fmt.Errorf("unable to listen on %s: %w", listenAddr, err)
	}
	attached := false
	conn.WithLock(func() {
		cur := conn.PortForwards[pf.ID]
		if cur == nil || cur != pf {
			return
		}
		pf.Listener = listener
		pf.Status = portForwardStatusRunning
		pf.LastError = ""
		attached = true
	})
	if !attached {
		listener.Close()
		return errors.New("port forward removed while starting")
	}
	conn.Infof(ctx, "port forward started: %s (%s -> %s)\n", pf.ID, net.JoinHostPort(pf.LocalHost, strconv.Itoa(pf.LocalPort)), net.JoinHostPort(pf.RemoteHost, strconv.Itoa(pf.RemotePort)))
	go conn.runPortForwardListener(pf.ID, listener)
	return nil
}

func (conn *SSHConn) finishPortForwardListener(id string, listener net.Listener, listenErr error) {
	conn.WithLock(func() {
		pf := conn.PortForwards[id]
		if pf == nil {
			return
		}
		if pf.Listener != listener {
			return
		}
		pf.Listener = nil
		if listenErr != nil {
			pf.Status = portForwardStatusError
			pf.LastError = listenErr.Error()
			return
		}
		if pf.Status == portForwardStatusRunning {
			pf.Status = portForwardStatusStopped
		}
	})
}

func closeWriteIfSupported(conn net.Conn) {
	type closeWriter interface {
		CloseWrite() error
	}
	if cw, ok := conn.(closeWriter); ok {
		cw.CloseWrite()
	}
}

func bridgePortForwardConns(localConn net.Conn, remoteConn net.Conn) {
	defer localConn.Close()
	defer remoteConn.Close()

	done := make(chan struct{}, 2)
	go func() {
		defer func() { done <- struct{}{} }()
		_, _ = io.Copy(remoteConn, localConn)
		closeWriteIfSupported(remoteConn)
	}()
	go func() {
		defer func() { done <- struct{}{} }()
		_, _ = io.Copy(localConn, remoteConn)
		closeWriteIfSupported(localConn)
	}()
	<-done
	<-done
}

func (conn *SSHConn) runPortForwardListener(id string, listener net.Listener) {
	var finishErr error
	defer conn.finishPortForwardListener(id, listener, finishErr)
	for {
		localConn, err := listener.Accept()
		if err != nil {
			if errors.Is(err, net.ErrClosed) {
				return
			}
			finishErr = err
			return
		}
		go conn.handlePortForwardConn(id, localConn)
	}
}

func (conn *SSHConn) handlePortForwardConn(id string, localConn net.Conn) {
	defer func() {
		if r := recover(); r != nil {
			log.Printf("panic while handling port forward connection (%s): %v", id, r)
		}
	}()
	var remoteHost string
	var remotePort int
	conn.WithLock(func() {
		pf := conn.PortForwards[id]
		if pf == nil {
			return
		}
		remoteHost = pf.RemoteHost
		remotePort = pf.RemotePort
	})
	if remoteHost == "" || remotePort == 0 {
		localConn.Close()
		return
	}
	client := conn.GetClient()
	if client == nil {
		_ = localConn.Close()
		conn.updatePortForwardError(id, fmt.Errorf("ssh client is not connected"))
		return
	}
	remoteAddr := net.JoinHostPort(remoteHost, strconv.Itoa(remotePort))
	remoteConn, err := client.Dial("tcp", remoteAddr)
	if err != nil {
		_ = localConn.Close()
		conn.updatePortForwardError(id, fmt.Errorf("dial remote %s failed: %w", remoteAddr, err))
		return
	}
	bridgePortForwardConns(localConn, remoteConn)
}

func (conn *SSHConn) ListPortForwards() []wshrpc.PortForwardInfo {
	conn.Lock.Lock()
	defer conn.Lock.Unlock()
	if len(conn.PortForwards) == 0 {
		return nil
	}
	rtn := make([]wshrpc.PortForwardInfo, 0, len(conn.PortForwards))
	for _, pf := range conn.PortForwards {
		rtn = append(rtn, conn.toPortForwardInfo(pf))
	}
	sort.Slice(rtn, func(i, j int) bool {
		if rtn[i].CreatedAt == rtn[j].CreatedAt {
			return rtn[i].Id < rtn[j].Id
		}
		return rtn[i].CreatedAt < rtn[j].CreatedAt
	})
	return rtn
}

func (conn *SSHConn) CreatePortForward(ctx context.Context, req wshrpc.CommandConnPortForwardCreateData) (wshrpc.PortForwardInfo, error) {
	localHost, err := normalizeLoopbackHost(req.LocalHost)
	if err != nil {
		return wshrpc.PortForwardInfo{}, err
	}
	if err := validateTCPPort(req.LocalPort, "local port"); err != nil {
		return wshrpc.PortForwardInfo{}, err
	}
	remoteHost := normalizeRemoteHost(req.RemoteHost)
	if err := validateTCPPort(req.RemotePort, "remote port"); err != nil {
		return wshrpc.PortForwardInfo{}, err
	}
	autoRestore := true
	if req.AutoRestore != nil {
		autoRestore = *req.AutoRestore
	}
	newID, err := newPortForwardID()
	if err != nil {
		return wshrpc.PortForwardInfo{}, err
	}
	pf := &managedPortForward{
		ID:          newID,
		LocalHost:   localHost,
		LocalPort:   req.LocalPort,
		RemoteHost:  remoteHost,
		RemotePort:  req.RemotePort,
		AutoRestore: autoRestore,
		CreatedAt:   time.Now().UnixMilli(),
		Status:      portForwardStatusStopped,
	}
	var dupId string
	conn.WithLock(func() {
		if conn.PortForwards == nil {
			conn.PortForwards = make(map[string]*managedPortForward)
		}
		if dup, existingId := conn.hasDuplicatePortForward_nolock(localHost, req.LocalPort); dup {
			dupId = existingId
			return
		}
		conn.PortForwards[pf.ID] = pf
	})
	if dupId != "" {
		return wshrpc.PortForwardInfo{}, fmt.Errorf("local endpoint %s:%d is already forwarded (%s)", localHost, req.LocalPort, dupId)
	}
	err = conn.startPortForward(ctx, pf)
	if err != nil {
		conn.WithLock(func() {
			cur := conn.PortForwards[pf.ID]
			if cur == pf && pf.Listener == nil {
				delete(conn.PortForwards, pf.ID)
			}
		})
		return wshrpc.PortForwardInfo{}, err
	}
	conn.persistPortForwards(ctx)
	return conn.toPortForwardInfo(pf), nil
}

func (conn *SSHConn) DeletePortForward(ctx context.Context, forwardId string) error {
	forwardId = strings.TrimSpace(forwardId)
	if forwardId == "" {
		return fmt.Errorf("forward id is required")
	}
	var listener net.Listener
	deleted := false
	conn.WithLock(func() {
		pf := conn.PortForwards[forwardId]
		if pf == nil {
			return
		}
		listener = pf.Listener
		delete(conn.PortForwards, forwardId)
		deleted = true
	})
	if !deleted {
		return fmt.Errorf("port forward not found: %s", forwardId)
	}
	if listener != nil {
		_ = listener.Close()
	}
	conn.persistPortForwards(ctx)
	return nil
}

func (conn *SSHConn) stopAllPortForwards_nolock(reason string) {
	if len(conn.PortForwards) == 0 {
		return
	}
	for _, pf := range conn.PortForwards {
		if pf.Listener != nil {
			_ = pf.Listener.Close()
			pf.Listener = nil
		}
		if pf.Status == portForwardStatusRunning {
			pf.Status = portForwardStatusStopped
		}
		if reason != "" {
			pf.LastError = reason
		}
	}
}

func (conn *SSHConn) restorePortForwards(ctx context.Context) {
	var toRestore []*managedPortForward
	conn.WithLock(func() {
		if len(conn.PortForwards) == 0 {
			return
		}
		for _, pf := range conn.PortForwards {
			if !pf.AutoRestore {
				continue
			}
			if pf.Listener != nil {
				continue
			}
			toRestore = append(toRestore, pf)
		}
	})
	for _, pf := range toRestore {
		if err := conn.startPortForward(ctx, pf); err != nil {
			conn.Infof(ctx, "WARN could not restore port forward %s: %v\n", pf.ID, err)
		}
	}
}
