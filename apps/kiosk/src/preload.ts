import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("kioskApi", {
  start: (username: string) => ipcRenderer.invoke("kiosk:start", username),
  getInfo: () => ipcRenderer.invoke("kiosk:info"),
});

declare global {
  interface Window {
    kioskApi: {
      start: (username: string) => Promise<any>;
      getInfo: () => Promise<any>;
    };
  }
}