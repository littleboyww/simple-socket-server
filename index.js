import express from "express"
import { Server } from "socket.io"
import { createServer } from "http"
import { v4 as uuidv4} from 'uuid'

const app = express()

const httpServer = createServer(app)
const io = new Server(httpServer, {})


let devices = {}
let rooms = {}

const publishActionNs = io.of("/")
publishActionNs.on("connection", (socket) => {
  console.log(`Socket ${socket.id} connected`)
  socket.on('register', (data, callback) => {
    console.log(`register:socketId:${socket.id} - data: ${data.toString()}`)
    const {deviceId, deviceName} = data
    const saved = {
      socketId: socket.id,
      deviceId: deviceId,
      deviceName: deviceName
    }
    if(devices[deviceId]) {
      callback({success: false, errorMsg: "Fail to init session!! Existed the connection with this device"})
    }
    devices[deviceId] = saved
    console.log("saved:log:" + devices)
    callback({success: true})
  })

  socket.on('createRoom', (data, callback) => {
    console.log(`createRoom:socketId:${socket.id} - data: ${data.toString()}`)
    const {deviceId, roomName} = data
    if(!devices[deviceId]) {
      callback({success: false, errorMsg: "Invalid credentials error!! Fail to create new Room"})
    }
    if(rooms[roomName]) {
      callback({success: false, errorMsg: "Room name existed!!"})
      return
    }
    publishActionNs.to(socket.id).socketsJoin(`/rooms/${roomName}`)
    rooms[roomName] = publishActionNs.to(`/rooms/${roomName}`)
    console.log("saved:log:" + devices)
    callback({success: true})
  })

  socket.on("joinRoom", (data, callback) => {
    console.log(`joinRoom:socketId:${socket.id} - data: ${data.toString()}`)
    const {deviceId, roomName} = data
    if(!devices[deviceId]) {
      callback({success: false, errorMsg: "Invalid credentials error!! Fail to create new Room"})
    }
    if(!rooms[roomName]) {
      callback({success: false, errorMsg: "Not found room!!"})
      return
    }
    publishActionNs.to(socket.id).socketsJoin(roomName)
    rooms[roomName].emit(`message`, { type: "USER_JOINED_EVENT", deviceId: deviceId, deviceName: devices[deviceId].deviceName })
  })

  socket.on("leaveRoom", (data) => {
    const { deviceId, roomName } = data
    if(rooms[roomName]) {
      socket.leave(`/rooms/${roomName}`)
      const roomClients = rooms[roomName].clients
      if(roomClients.length === 0) {
        delete rooms[roomName]
      } else {
        rooms[roomName].emit("message", { type: "USER_LEAVED_EVENT", deviceId: deviceId, deviceName: devices[deviceId].deviceName })
      }
    }
  })

  socket.on('disconnecting', () => {
    console.log(`disconnecting:socketId:${socket.id}`)
    let inRooms = Object.keys(socket.rooms)
    inRooms.forEach((room) => {
      socket.to(room).emit("message", { type: "USER_" })
    })
  })
})
