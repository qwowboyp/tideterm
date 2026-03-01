// Copyright 2025, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

package wshserver

import (
	"context"
	"fmt"
	"strings"

	"github.com/sanshao85/tideterm/pkg/genconn"
	"github.com/sanshao85/tideterm/pkg/remote"
	"github.com/sanshao85/tideterm/pkg/remote/conncontroller"
	"github.com/sanshao85/tideterm/pkg/wshrpc"
)

func normalizePortForwardConnName(connName string) (string, error) {
	connName = strings.TrimSpace(connName)
	if connName == "" {
		return "", fmt.Errorf("connection name is required")
	}
	if conncontroller.IsLocalConnName(connName) {
		return "", fmt.Errorf("port forwarding is only available for ssh remote connections")
	}
	if strings.HasPrefix(connName, "wsl://") {
		return "", fmt.Errorf("port forwarding is not yet supported for wsl connections")
	}
	if strings.HasPrefix(connName, "aws:") {
		return "", fmt.Errorf("port forwarding is not supported for aws profile connections")
	}
	return connName, nil
}

func getSshConnForPortForward(connName string) (*conncontroller.SSHConn, error) {
	connOpts, err := remote.ParseOpts(connName)
	if err != nil {
		return nil, fmt.Errorf("error parsing connection name: %w", err)
	}
	conn := conncontroller.GetConn(connOpts)
	if conn == nil {
		return nil, fmt.Errorf("connection not found: %s", connName)
	}
	return conn, nil
}

func (ws *WshServer) ConnPortForwardCreateCommand(ctx context.Context, data wshrpc.CommandConnPortForwardCreateData) (wshrpc.PortForwardInfo, error) {
	connName, err := normalizePortForwardConnName(data.ConnName)
	if err != nil {
		return wshrpc.PortForwardInfo{}, err
	}
	ctx = genconn.ContextWithConnData(ctx, data.LogBlockId)
	ctx = termCtxWithLogBlockId(ctx, data.LogBlockId)
	if err := conncontroller.EnsureConnection(ctx, connName); err != nil {
		return wshrpc.PortForwardInfo{}, err
	}
	conn, err := getSshConnForPortForward(connName)
	if err != nil {
		return wshrpc.PortForwardInfo{}, err
	}
	data.ConnName = connName
	return conn.CreatePortForward(ctx, data)
}

func (ws *WshServer) ConnPortForwardListCommand(ctx context.Context, data wshrpc.CommandConnPortForwardListData) ([]wshrpc.PortForwardInfo, error) {
	connName, err := normalizePortForwardConnName(data.ConnName)
	if err != nil {
		return nil, err
	}
	conn, err := getSshConnForPortForward(connName)
	if err != nil {
		return nil, err
	}
	return conn.ListPortForwards(), nil
}

func (ws *WshServer) ConnPortForwardDeleteCommand(ctx context.Context, data wshrpc.CommandConnPortForwardDeleteData) error {
	connName, err := normalizePortForwardConnName(data.ConnName)
	if err != nil {
		return err
	}
	conn, err := getSshConnForPortForward(connName)
	if err != nil {
		return err
	}
	return conn.DeletePortForward(ctx, data.ForwardId)
}
