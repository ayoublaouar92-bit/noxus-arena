import { contextBridge, ipcRenderer } from "electron";


contextBridge.exposeInMainWorld(

  "api",

  {


    getDevices:()=>ipcRenderer.invoke(
      "get-devices"
    ),



    addDevice:(device:any)=>ipcRenderer.invoke(
      "add-device",
      device
    ),




    startSession:(data:any)=>ipcRenderer.invoke(
      "start-session",
      data
    ),




    getActiveSessions:()=>ipcRenderer.invoke(
      "get-active-sessions"
    ),




    endSession:(id:number)=>ipcRenderer.invoke(
      "end-session",
      id
    )



  }

);