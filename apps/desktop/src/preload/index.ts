import {
  contextBridge,
  ipcRenderer,
} from "electron";

const api = {
  getDevices: () => {
    return ipcRenderer.invoke(
      "get-devices"
    );
  },

  addDevice: (device: {
    name: string;
    type: string;
    ip?: string;
    mac?: string;
    price: string;
  }) => {
    return ipcRenderer.invoke(
      "add-device",
      device
    );
  },

  startSession: (data: {
    deviceId: number;
    customerName?: string;
  }) => {
    return ipcRenderer.invoke(
      "start-session",
      data
    );
  },

  getActiveSessions: () => {
    return ipcRenderer.invoke(
      "get-active-sessions"
    );
  },

  endSession: (sessionId: number) => {
    return ipcRenderer.invoke(
      "end-session",
      sessionId
    );
  },

  getPlayers: () => {
    return ipcRenderer.invoke(
      "get-players"
    );
  },

  addPlayer: (player: {
    name: string;
    username: string;
    phone?: string;
    balance?: number;
    image?: string;
  }) => {
    return ipcRenderer.invoke(
      "add-player",
      player
    );
  },

  deletePlayer: (playerId: number) => {
    return ipcRenderer.invoke(
      "delete-player",
      playerId
    );
  },
};

contextBridge.exposeInMainWorld(
  "api",
  api
);