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
    if(devices[socket.id]) {
      callback({success: false, errorMsg: "Fail to init session!! Existed the connection with this device"})
    }
    
    devices[socket.id] = saved
    console.log("saved:log:" + devices)
    callback({success: true})
  })

  socket.on('createRoom', (data, callback) => {
    console.log(`createRoom:socketId:${socket.id} - data: ${data.toString()}`)
    const {deviceId, roomName} = data
    if(!devices[socketId]) {
      callback({success: false, errorMsg: "Invalid credentials error!! Fail to create new Room"})
    }
    
    if(rooms[roomName]) {
      callback({success: false, errorMsg: "Room name existed!!"})
      return
    }
    publishActionNs.to(socket.id).socketsJoin(`/rooms/${roomName}`)
    rooms[roomName] = publishActionNs.to(`/rooms/${roomName}`)
    console.log(`createRoom:savedRoom:${rooms}`)
    callback({success: true})
  })

  socket.on("joinRoom", (data, callback) => {
    console.log(`joinRoom:socketId:${socket.id} - data: ${data.toString()}`)
    const {deviceId, roomName} = data

    if(!devices[socket.id]) {
      console.log(`joinRoom:socketId:${socket.id}:callback - Invalid credentials error!! Fail to create new Room`)
      callback({success: false, errorMsg: "Invalid credentials error!! Fail to create new Room"})
    } else {
      if(!getDeviceByDeviceId(deviceId)) {
        console.log(`joinRoom:socketId:${socket.id}:callback - Invalid credentials error!! Fail to create new Room`)
        callback({success: false, errorMsg: "Invalid credentials error!! Fail to create new Room"})
        return
      }
    }
    if(!rooms[roomName]) {
      console.log(`joinRoom:socketId:${socket.id}:callback - Not found room!!`)
      callback({success: false, errorMsg: "Not found room!!"})
      return
    }
    publishActionNs.to(socket.id).socketsJoin(roomName)
    rooms[roomName].emit(`message`, { type: "USER_JOINED_EVENT", deviceId: devices[socket.id].deviceId, deviceName: devices[socket.id].deviceName })
    console.log(`joinRoom:socketId:${socket.id}:callback - success`)
    callback({success: true})
  })

  socket.on("leaveRoom", (data) => {
    const { deviceId, roomName } = data
    handleLeaveRoom(deviceId, roomName)
  
  })

  socket.on('disconnect', () => {
    if(devices[socket.id]) {
      console.log("disconnect:existedDevice:" + socket.id)
      const deviceId = devices[socket.id].deviceId
      const inRooms = Object.keys(socket.rooms)
      inRooms.forEach((room) => {
        console.log("disconnect:room:" + room)
        handleLeaveRoom(deviceId, room)
      })
      delete devices[socket.id]
    }    
    console.log("disconnect:socketId:" + socket.id)
  })


  const handleLeaveRoom = (deviceId, roomName) => {
    if(rooms[roomName]) {
      socket.leave((roomName))
      const roomClients = rooms[roomName].clients
      if(roomClients.length === 0) {
        delete rooms[roomName]
      } else {
        socket.to(roomName).emit('message', {type: "USER_LEAVED_EVENT", deviceId: deviceId, deviceName: devices[deviceId].deviceName})
      }
    }
  }
})

const getDeviceByDeviceId = (deviceId) => {
  return Object.values(devices).find(device => device.deviceId === deviceId)
}

io.on("connection", (socket) => {
  console.log("Connect socket: " + socket.id)
})
const PORT = process.env.PORT || 3000
httpServer.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`)
})