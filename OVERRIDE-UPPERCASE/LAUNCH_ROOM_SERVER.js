/*
 * 게임메이커용 룸 서버 OVERRIDE
 */
OVERRIDE(LAUNCH_ROOM_SERVER, (origin) => {
	
	global.LAUNCH_ROOM_SERVER = CLASS((cls) => {
	
		let initRoomFuncMap = {};
		let sendMap = {};
	
		let addInitRoomFunc = cls.addInitRoomFunc = (roomName, initRoomFunc) => {
			//REQUIRED: roomName
			//REQUIRED: initRoomFunc
	
			if (initRoomFuncMap[roomName] === undefined) {
				initRoomFuncMap[roomName] = [];
			}
	
			initRoomFuncMap[roomName].push(initRoomFunc);
		};
	
		let broadcast = cls.broadcast = (params, _send) => {
			//REQUIRED: params
			//REQUIRED: params.roomName
			//OPTIONAL: params.methodName
			//OPTIONAL: params.data
			//OPTIONAL: params.str
			//OPTIONAL: _send
	
			let roomName = params.roomName;
			let sends = sendMap[roomName];
	
			if (sends !== undefined) {
	
				EACH(sends, (send) => {
					
					if (send !== _send) {
						
						if (params.str !== undefined) {
							
							send({
								str : params.str
							});
						}
	
						else {
							
							send({
								methodName : roomName + '/' + params.methodName,
								data : params.data
							});
						}
					}
				});
			}
		};
	
		return {
	
			init : (inner, self, params) => {
				//REQUIRED: params
				//OPTIONAL: params.socketServerPort
				//OPTIONAL: params.webSocketServerPort
				//OPTIONAL: params.webServer
				
				if (CPU_CLUSTERING.on !== undefined) {
	
					CPU_CLUSTERING.on('__LAUNCH_ROOM_SERVER__MESSAGE', broadcast);
				}
	
				if (SERVER_CLUSTERING.on !== undefined) {
	
					SERVER_CLUSTERING.on('__LAUNCH_ROOM_SERVER__MESSAGE', (params) => {
	
						broadcast(params);
	
						if (CPU_CLUSTERING.broadcast !== undefined) {
	
							CPU_CLUSTERING.broadcast({
								methodName : '__LAUNCH_ROOM_SERVER__MESSAGE',
								data : params
							});
						}
					});
				}
	
				let multiProtocolSocketServer = MULTI_PROTOCOL_SOCKET_SERVER(params, (clientInfo, on, off, send, disconnect) => {
	
					let roomCounts = {};
					let methodMaps = {};
	
					on('__ENTER_ROOM', (roomName) => {
	
						let initRoomFuncs = initRoomFuncMap[roomName];
						let sends = sendMap[roomName];
						
						if (roomCounts[roomName] === undefined) {
							roomCounts[roomName] = 1;
							
							let methodMap = methodMaps[roomName] = {};
	
							if (initRoomFuncs !== undefined) {
	
								EACH(initRoomFuncs, (initRoomFunc) => {
									initRoomFunc(clientInfo,
	
									// on.
									(methodName, method) => {
										//REQUIRED: methodName
										//REQUIRED: method
										
										let realMethodName = methodName === '__DISCONNECTED' ? methodName : roomName + '/' + methodName;
										let methods = methodMap[realMethodName];
						
										if (methods === undefined) {
											methods = methodMap[realMethodName] = [];
										}
						
										methods.push(method);
										
										on(realMethodName, method);
									},
	
									// off.
									(methodName, method) => {
										//REQUIRED: methodName
										//OPTIONAL: method
										
										let realMethodName = methodName === '__DISCONNECTED' ? methodName : roomName + '/' + methodName;
										let methods = methodMap[realMethodName];
						
										if (methods !== undefined) {
						
											if (method !== undefined) {
						
												REMOVE({
													array : methods,
													value : method
												});
						
											} else {
												delete methodMap[realMethodName];
											}
										}
	
										off(realMethodName, method);
									},
	
									// send.
									(params, callback) => {
										//REQUIRED: params
										//OPTIONAL: params.methodName
										//OPTIONAL: params.data
										//OPTIONAL: params.str
										//OPTIONAL: callback
										
										let methodName = params.methodName;
										let data = params.data;
										let str = params.str;
										
										if (str !== undefined) {
											
											send({
												str : str
											}, callback);
										}
										
										else {
											
											send({
												methodName : roomName + '/' + methodName,
												data : data
											}, callback);
										}
									},
									
									// broadcast except me
									(params) => {
										//REQUIRED: params
										//OPTIONAL: params.methodName
										//OPTIONAL: params.data
										//OPTIONAL: params.str
										
										let methodName = params.methodName;
										let data = params.data;
										let str = params.str;
										
										if (str !== undefined) {
											
											LAUNCH_ROOM_SERVER.broadcast({
												roomName : roomName,
												str : str
											}, send);
								
											if (CPU_CLUSTERING.broadcast !== undefined) {
								
												CPU_CLUSTERING.broadcast({
													methodName : '__LAUNCH_ROOM_SERVER__MESSAGE',
													data : {
														roomName : roomName,
														str : str
													}
												});
											}
								
											if (SERVER_CLUSTERING.broadcast !== undefined) {
								
												SERVER_CLUSTERING.broadcast({
													methodName : '__LAUNCH_ROOM_SERVER__MESSAGE',
													data : {
														roomName : roomName,
														str : str
													}
												});
											}
										}
										
										else {
											
											LAUNCH_ROOM_SERVER.broadcast({
												roomName : roomName,
												methodName : methodName,
												data : data
											}, send);
								
											if (CPU_CLUSTERING.broadcast !== undefined) {
								
												CPU_CLUSTERING.broadcast({
													methodName : '__LAUNCH_ROOM_SERVER__MESSAGE',
													data : {
														roomName : roomName,
														methodName : methodName,
														data : data
													}
												});
											}
								
											if (SERVER_CLUSTERING.broadcast !== undefined) {
								
												SERVER_CLUSTERING.broadcast({
													methodName : '__LAUNCH_ROOM_SERVER__MESSAGE',
													data : {
														roomName : roomName,
														methodName : methodName,
														data : data
													}
												});
											}
										}
									},
									
									disconnect);
								});
							}
	
							if (sends === undefined) {
								sends = sendMap[roomName] = [];
							}
	
							sends.push(send);
	
						} else {
							roomCounts[roomName] += 1;
						}
					});
	
					on('__EXIT_ROOM', (roomName) => {
						
						if (roomCounts[roomName] !== undefined) {
							roomCounts[roomName] -= 1;
	
							if (roomCounts[roomName] === 0) {
	
								REMOVE({
									array : sendMap[roomName],
									value : send
								});
	
								if (sendMap[roomName].length === 0) {
									delete sendMap[roomName];
								}
								delete roomCounts[roomName];
								
								// off all room's methods.
								EACH(methodMaps[roomName], (methods, methodName) => {
									EACH(methods, (method) => {
										
										if (methodName === '__DISCONNECTED') {
											method();
										}
										
										off(methodName, method);
									});
								});
							}
						}
					});
	
					on('__DISCONNECTED', () => {
	
						EACH(roomCounts, (roomCount, roomName) => {
	
							REMOVE({
								array : sendMap[roomName],
								value : send
							});
	
							if (sendMap[roomName].length === 0) {
								delete sendMap[roomName];
							}
						});
	
						// free memory.
						roomCounts = undefined;
						methodMaps = undefined;
					});
				});
			}
		};
	});
});