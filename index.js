import express from "express"
import { Server } from "socket.io"
import { createServer } from "http"
import { v4 as uuidv4} from 'uuid'
import { publicDecrypt } from "crypto"

const app = express()

const httpServer = createServer(app)
const io = new Server(httpServer, {})


let devices = {}
let rooms = {}

const publishActionNs = io.of("/")
publishActionNs.on("connection", (socket) => {
  console.log(`Socket ${socket.id} connected`)
  socket.on('register', (data, callback) => {
    data = JSON.parse(data)
    console.log(`register:socketId:${socket.id} - data: ${data.toString()}`)
    console.log(`data: ${data}`)
    const {deviceId, deviceName} = data
    console.log("deviceId from data: " + deviceId)
    console.log("deviceName from data: " + deviceName)
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
    console.log(devices[socket.id].toString() + ", " + devices[socket.id].deviceId + ", " + devices[socket.id].deviceName)
    callback({success: true})
  })

  socket.on('createRoom', (data, callback) => {
    if(typeof data == "string") {
      data = JSON.parse(data)
    } 
    console.log(`createRoom:socketId:${socket.id} - data: ${data.toString()}`)
    const {deviceId, roomName} = data
    if(!devices[socket.id]) {
      callback({success: false, errorMsg: "Invalid credentials error!! Fail to create new Room"})
      return
    }
    
    if(rooms[roomName]) {
      callback({success: false, errorMsg: "Room name existed!!"})
      return
    }
    publishActionNs.to(socket.id).socketsJoin(`/rooms/${roomName}`)
    rooms[roomName] = publishActionNs.to(`/rooms/${roomName}`)
    console.log(`createRoom:savedRoom:${rooms}`)
    callback({success: true})
    rooms[roomName].emit(`message`, { type: "USER_JOINED_EVENT", deviceId: devices[socket.id].deviceId, deviceName: devices[socket.id].deviceName })
  })

  socket.on("joinRoom", (data, callback) => {
    console.log(`joinRoom:socketId:${socket.id} - data: ${data.toString()}`)
    const {roomName} = data

    if(!devices[socket.id]) {
      console.log(`joinRoom:socketId:${socket.id}:callback - Invalid credentials error!! Fail to join room`)
      callback({success: false, errorMsg: "Invalid credentials error!! Fail to create new Room"})
      return
    } 
    if(!rooms[roomName]) {
      console.log(`joinRoom:socketId:${socket.id}:callback - Not found room!!`)
      callback({success: false, errorMsg: "Not found room!!"})
      return
    }
    publishActionNs.to(socket.id).socketsJoin(`/rooms/${roomName}`)
    rooms[roomName].emit(`message`, { type: "USER_JOINED_EVENT", deviceId: devices[socket.id].deviceId, deviceName: devices[socket.id].deviceName })
    console.log(`joinRoom:socketId:${socket.id}:callback - success`)
    callback({success: true})
  })
  
  socket.on('message', (data, callback) => {
    if(typeof data == 'string') {
      data = JSON.parse(data)
    }
   console.log(`message:socketId:${socket.id} - data: ${data}`)
   const {message, roomName} = data
    if(!devices[socket.id]) {
      console.log(`message:socketId:${socket.id}:callback - Invalid credentials error!! Fail to send message`)
      callback({success: false, errorMsg: "Invalid credentials error!! Fail to send message"})
      return
    }
    if(!rooms[roomName]) {
      console.log(`message:socketId:${socket.id}:callback - Not found room!!`)
      callback({success: false, errorMsg: "Failed to send message!! This room wasn't exist"})
      return
    }
    console.log("message:room:socketId:" + socket.id + `:${socket.rooms}`)
    socket.to(`/rooms/${roomName}`).emit('message', {type: "MESSAGE", deviceId: devices[socket.id].deviceId, deviceName: devices[socket.id].deviceName, message: message})
    callback({success: true})
  })

  socket.on("leaveRoom", (data) => {
    const { roomName } = data
    console.log(`leaveRoom:socketId:${socket.id}`)
    leaveWithRoomName(roomName)

  })

  socket.on('disconnect', () => {
    if(devices[socket.id]) {
      console.log("disconnect:existedDevice:" + socket.id)
      delete devices[socket.id]
    }    
    console.log("disconnect:socketId:" + socket.id)
  })

  socket.on('disconnecting', () => {
    if(devices[socket.id]) {
      console.log("disconnecting:existedDevice:" + socket.id)
      handleDisconnect(socket.id)
     
    }
    console.log("disconnecting:socketId:" + socket.id)
  })

  const leaveWithRoomName = (roomName) => {
    if(rooms[roomName]) {
      socket.leave(`/rooms/${roomName}`)
      console.log(publishActionNs.adapter.rooms)
      const clientsInRoom = publishActionNs.adapter.rooms[`/rooms/${roomName}`]
      console.log(`leaveWithRoomName:clientsInRoom:${clientsInRoom}`)
      if(clientsInRoom && clientsInRoom.length == 0) {
        console.log(`leaveWithRoomName:clientsInRoom:length 0`)
        delete rooms[roomName]
        console.log(rooms)
      } else {
        publishActionNs.to(`/rooms/${roomName}`).emit('message', {type: "USER_LEAVED_EVENT", deviceId: devices[socket.id].deviceId, deviceName: devices[socket.id].deviceName})
      }
    }
  }

  const handleDisconnect = (id) => {
    const joinedRoom = publishActionNs.adapter.sids[id]
    console.log(`handleDisconnect:socketId:${socket.id}:joinedRoom:${joinedRoom}`)
    if(joinedRoom) {
      for(let room in joinedRoom) {
        socket.leave(room)
        const clientsInRoom = publishActionNs.adapter.rooms[room]
        if(clientsInRoom && clientsInRoom.length === 0 ) {
          console.log(`handleDisconnect:socketId:${socket.id}:room:${room}:clientsInRoom:${clientsInRoom.length}`)
        }
        if(clientsInRoom.length === 0) {
          const roomToDelete = room.replace('/rooms/', '');
          if (roomToDelete) {
              delete rooms[roomToDelete];
          }
          
        } else {
          publishActionNs.to(room).emit('message', {type: "USER_LEAVED_EVENT", deviceId: devices[socket.id].deviceId, deviceName: devices[socket.id].deviceName})
        }
      }    
    }
  }

  const handleLeaveRoom = (roomName) => {
    if(rooms[roomName]) {
      socket.leave((roomName))
      const roomClients = rooms[roomName].clients
      if(roomClients.length === 0) {
        delete rooms[roomName]
      } else {
        socket.to(roomName).emit('message', {type: "USER_LEAVED_EVENT", deviceId: devices[socket.id].deviceId, deviceName: devices[socket.id].deviceName})
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