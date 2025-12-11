import { io, Socket } from 'socket.io-client';
import { getSocketUrl } from './api';
import type { FrameData, SinkRegion, Violation } from '../types';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(getSocketUrl(), {
      transports: ['websocket', 'polling'],
    });
  }
  return socket;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

// Event emitters
export function startDetection(): void {
  getSocket().emit('start_detection');
}

export function stopDetection(): void {
  getSocket().emit('stop_detection');
}

export function setSinkRegionSocket(region: SinkRegion): void {
  getSocket().emit('set_sink_region', { sink_region: region });
}

// Event listeners (returns cleanup function)
export function onFrame(callback: (data: FrameData) => void): () => void {
  const socket = getSocket();
  socket.on('frame', callback);
  return () => socket.off('frame', callback);
}

export function onStatus(callback: (data: { message: string; running: boolean }) => void): () => void {
  const socket = getSocket();
  socket.on('status', callback);
  return () => socket.off('status', callback);
}

export function onError(callback: (data: { message: string }) => void): () => void {
  const socket = getSocket();
  socket.on('error', callback);
  return () => socket.off('error', callback);
}

export function onViolation(callback: (data: Violation) => void): () => void {
  const socket = getSocket();
  socket.on('violation', callback);
  return () => socket.off('violation', callback);
}

export function onViolationUpdate(callback: (data: Violation) => void): () => void {
  const socket = getSocket();
  socket.on('violation_update', callback);
  return () => socket.off('violation_update', callback);
}

export function onSinkRegion(callback: (data: { sink_region: SinkRegion }) => void): () => void {
  const socket = getSocket();
  socket.on('sink_region', callback);
  return () => socket.off('sink_region', callback);
}

export function onConnect(callback: () => void): () => void {
  const socket = getSocket();
  socket.on('connect', callback);
  return () => socket.off('connect', callback);
}

export function onDisconnect(callback: () => void): () => void {
  const socket = getSocket();
  socket.on('disconnect', callback);
  return () => socket.off('disconnect', callback);
}

