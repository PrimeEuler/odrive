var events      = require('events');
var UInt64BE    = require("int64-buffer").Uint64BE
var UInt64LE    = require("int64-buffer").Uint64LE
var Int64BE     = require("int64-buffer").int64BE
var Int64LE     = require("int64-buffer").int64LE
var fibre       = require('fibre');
var enums = {
    axis: {
        state:{
            0:'AXIS_STATE_UNDEFINED',
            1:'AXIS_STATE_IDLE',
            2:'AXIS_STATE_STARTUP_SEQUENCE',
            3:'AXIS_STATE_FULL_CALIBRATION_SEQUENCE',
            4:'AXIS_STATE_MOTOR_CALIBRATION',
            5:'AXIS_STATE_SENSORLESS_CONTROL',
            6:'AXIS_STATE_ENCODER_INDEX_SEARCH',
            7:'AXIS_STATE_ENCODER_OFFSET_CALIBRATION',
            8:'AXIS_STATE_CLOSED_LOOP_CONTROL',
            9:'AXIS_STATE_LOCKIN_SPIN',
            10:'AXIS_STATE_ENCODER_DIR_FIND'
        },
        error:{
            0x00:'ERROR_NONE',
            0x01:'ERROR_INVALID_STATE',
            0x02:'ERROR_DC_BUS_UNDER_VOLTAGE',
            0x04:'ERROR_DC_BUS_OVER_VOLTAGE',
            0x08:'ERROR_CURRENT_MEASUREMENT_TIMEOUT',
            0x10:'ERROR_BRAKE_RESISTOR_DISARMED',
            0x20:'ERROR_MOTOR_DISARMED',
            0x40:'ERROR_MOTOR_FAILED',
            0x80:'ERROR_SENSORLESS_ESTIMATOR_FAILED',
            0x100:'ERROR_ENCODER_FAILED',
            0x200:'ERROR_CONTROLLER_FAILED',
            0x400:'ERROR_POS_CTRL_DURING_SENSORLESS',
            0x800:'ERROR_WATCHDOG_TIMER_EXPIRED'
            
        }
    },
    motor: {
        type:{
            0:'MOTOR_TYPE_HIGH_CURRENT',
            1:'MOTOR_TYPE_LOW_CURRENT',
            2:'MOTOR_TYPE_GIMBAL',
        },
        error:{
            0x0000:'ERROR_NONE',
            0x0001:'ERROR_PHASE_RESISTANCE_OUT_OF_RANGE',
            0x0002:'ERROR_PHASE_INDUCTANCE_OUT_OF_RANGE',
            0x0004:'ERROR_ADC_FAILED',
            0x0008:'ERROR_DRV_FAULT',
            0x0010:'ERROR_CONTROL_DEADLINE_MISSED',
            0x0020:'ERROR_NOT_IMPLEMENTED_MOTOR_TYPE',
            0x0040:'ERROR_BRAKE_CURRENT_OUT_OF_RANGE',
            0x0080:'ERROR_MODULATION_MAGNITUDE',
            0x0100:'ERROR_BRAKE_DEADTIME_VIOLATION',
            0x0200:'ERROR_UNEXPECTED_TIMER_CALLBACK',
            0x0400:'ERROR_CURRENT_SENSE_SATURATION'
        }
    },
    controller: {
        mode:{
            0:'CTRL_MODE_VOLTAGE_CONTROL',
            1:'CTRL_MODE_CURRENT_CONTROL',
            2:'CTRL_MODE_VELOCITY_CONTROL',
            3:'CTRL_MODE_POSITION_CONTROL',
            4:'CTRL_MODE_TRAJECTORY_CONTROL'
        },
        error:{
            0x00:'ERROR_NONE',
            0x01:'ERROR_OVERSPEED'
        }
    },
    encoder: {
        mode:{
            0:'ENCODER_MODE_INCREMENTAL',
            1:'ENCODER_MODE_HALL'
        },
        error:{
            0x00:'ERROR_NONE',
            0x01:'ERROR_UNSTABLE_GAIN', 
            0x02:'ERROR_CPR_OUT_OF_RANGE',
            0x04:'ERROR_NO_RESPONSE',
            0x08:'ERROR_UNSUPPORTED_ENCODER_MODE',
            0x10:'ERROR_ILLEGAL_HALL_STATE',
            0x20:'ERROR_INDEX_NOT_FOUND_YET'
        }
    },
    sensorless_estimator:{
        error:{
            0: 'ERROR_NONE',
            0x01: 'ERROR_UNSTABLE_GAIN'
        }
    }
}

function odrive(){
    var self = new events.EventEmitter();
        self.fibre = new fibre();
        
        self.endpoints = []
    function compile(endpoints,parent,namespace){
        namespace = namespace || '';
        var object =  {}
        endpoints.forEach(function(endpoint){
            if(!object[endpoint.name]){ 
                object[endpoint.name] = {} 
            }
            
            //enums
            switch(endpoint.name){
                case 'error':
                    endpoint.enum = enums[parent].error;
                    break;
                case 'motor_type':
                    endpoint.enum = enums.motor.type;
                    break;
                case 'mode':
                    endpoint.enum = enums.encoder.mode
                    break;
                case 'control_mode':
                    endpoint.enum = enums.controller.mode
                    break;
                case 'requested_state':    
                case 'current_state':
                    endpoint.enum = enums.axis.state
                    break;
            }
            //serialization 
            switch(endpoint.type){
                case 'object':
                    parent = endpoint.name;
                    endpoint.namespace = namespace + '.' + endpoint.name
                    if (parent.indexOf('axis')===0){parent = 'axis' }
                    object[endpoint.name] = compile(endpoint.members, parent, endpoint.namespace );
                    
                    break;
                case 'function':
                    endpoint.namespace = namespace + '.' + endpoint.name
                    object[endpoint.name].call = function(callback){
                        callback=callback||function(){}
                        self.fibre.get( endpoint.id, 0, function(){
                            //call getters to update loadl copy
                            unmarshal(object[endpoint.name].inputs)
                            unmarshal(object[endpoint.name].outputs)
                            setTimeout(function(){ callback( unmarshal(object[endpoint.name]) ) },100)
                        })
                    }
                    object[endpoint.name].inputs = compile(endpoint.inputs,parent, endpoint.namespace + '.inputs')
                    object[endpoint.name].outputs = compile(endpoint.outputs,parent, endpoint.namespace + '.outputs' )
                    
                    break;
                default:
                    endpoint.namespace = namespace + '.' + endpoint.name
                    marshal(object,endpoint,'LE')
                    break;
            }
            //reference
            self.endpoints[endpoint.id] = endpoint
            
        })
        return object
    }
    function marshal(object, endpoint,endian){
        var type = '';
        var buffer;
        var get = function(){}
        var set = function(){}

        endian = endian || 'LE'
        function check(buff1, length){
            if(buff1.length === length){
                return Buffer.from(buff1)
            }else{
                throw 'Error.' + endpoint.id +' Buffer mismatch: ' + buff1.length + '!=' + length 
            }
        }
        switch(endpoint.type){
            case 'uint8':
                endpoint.length = 1
                buffer = Buffer.alloc(1); 
                get = function(    ){
                    self.fibre.get(endpoint.id,endpoint.length,function(data){
                        if(Buffer.isBuffer(data)){
                            buffer = check(data, endpoint.length)
                        }
                    })
                    if(endpoint.enum){
                        return endpoint.enum[buffer.readUInt8(0)];
                    }else{
                        return buffer.readUInt8(0);
                    }
                    
                };
                set = function(data){
                    if(endpoint.access!=='rw'){
                        throw 'Error: Access ' + endpoint.access
                        return
                    }
                    buffer.writeUInt8(data, 0)
                    self.fibre.set(endpoint.id, buffer, function(stale){})
                };
                break;
            case 'uint16':
                endpoint.length = 2;
                buffer = Buffer.alloc(2); 
                get = function(    ){
                    self.fibre.get(endpoint.id,endpoint.length,function(data){
                        if(Buffer.isBuffer(data)){
                            buffer = check(data, endpoint.length)
                        }
                    })
                    if(endpoint.enum){
                        return endpoint.enum[buffer.readUInt16LE(0)];
                    }else{
                        return buffer.readUInt16LE(0);
                    }
                    
                };
                set = function(data){
                    if(endpoint.access!=='rw'){
                        throw 'Error: Access ' + endpoint.access
                        return
                    }
                    buffer.writeUInt16LE(data, 0)
                    self.fibre.set(endpoint.id, buffer, function(stale){})
                };
                break;
            case 'uint32':  
                endpoint.length = 4;
                buffer = Buffer.alloc(4); 
                get = function(    ){
                    self.fibre.get(endpoint.id,endpoint.length,function(data){
                        if(Buffer.isBuffer(data)){
                            buffer = check(data, endpoint.length)
                        }
                    })
                    if(endpoint.enum){
                        return endpoint.enum[buffer.readUInt32LE(0)];
                    }else{
                        return buffer.readUInt32LE(0);
                    }
                };
                set = function(data){
                    if(endpoint.access!=='rw'){
                        throw 'Error: Access ' + endpoint.access
                        return
                    }
                    buffer.writeUInt32LE(data, 0)
                    self.fibre.set(endpoint.id, buffer, function(stale){})
                };
                break;
            case 'uint64':
                endpoint.length = 8
                buffer = new UInt64LE(0); 
                get = function(    ){
                    self.fibre.get(endpoint.id,endpoint.length,function(data){
                        if(Buffer.isBuffer(data)){
                            buffer = new UInt64LE(check(data, endpoint.length))
                        }
                    })
                    return buffer - 0 ;
                    
                };
                set = function(data){
                    if(endpoint.access!=='rw'){
                        throw 'Error: Access ' + endpoint.access
                        return
                    }
                    buffer = new UInt64LE(data)
                    self.fibre.set(endpoint.id, buffer, function(stale){})
                };
                break;
            case 'int8':
                endpoint.length = 1
                buffer = Buffer.alloc(1); 
                get = function(    ){
                    self.fibre.get(endpoint.id,endpoint.length,function(data){
                        if(Buffer.isBuffer(data)){
                            buffer = check(data, endpoint.length)
                        }
                    })
                    if(endpoint.enum){
                        return endpoint.enum[buffer.readInt8(0)];
                    }else{
                        return buffer.readInt8(0);
                    }
                };
                set = function(data){
                    if(endpoint.access!=='rw'){
                        throw 'Error: Access ' + endpoint.access
                        return
                    }
                    buffer.writeInt8(data, 0)
                    self.fibre.set(endpoint.id, buffer, function(stale){})

                };
                break;
            case 'int16':
                endpoint.length = 2
                buffer = Buffer.alloc(2); 
                get = function(    ){
                    self.fibre.get(endpoint.id,endpoint.length,function(data){
                        if(Buffer.isBuffer(data)){
                            buffer = check(data, endpoint.length)
                        }
                    })
                    if(endpoint.enum){
                        return endpoint.enum[buffer.readInt16LE(0)];
                    }else{
                        return buffer.readInt16LE(0);
                    }
                };
                set = function(data){
                    if(endpoint.access!=='rw'){
                        throw 'Error: Access ' + endpoint.access
                        return
                    }
                    buffer.writeInt16LE(data, 0)
                    self.fibre.set(endpoint.id, buffer, function(stale){})
                };
                break;
            case 'int32':
                endpoint.length = 4
                buffer = Buffer.alloc(4); 
                get = function(    ){
                    self.fibre.get(endpoint.id,endpoint.length,function(data){
                        if(Buffer.isBuffer(data)){
                            buffer = check(data, endpoint.length)
                        }
                    })
                    if(endpoint.enum){
                        return endpoint.enum[buffer.readInt32LE(0)];
                    }else{
                        return buffer.readInt32LE(0);
                    }
                };
                set = function(data){
                    if(endpoint.access!=='rw'){
                        throw 'Error: ' + endpoint.access
                        return
                    }
                    buffer.writeInt32LE(data, 0)
                    self.fibre.set(endpoint.id, buffer, function(stale){})
                };
                break;
            case 'int64':
                endpoint.length = 8
                buffer = new Int64LE(0); 
                get = function(    ){
                    self.fibre.get(endpoint.id,endpoint.length,function(data){
                        if(Buffer.isBuffer(data)){
                            buffer = new Int64LE( check(data, endpoint.length) )
                        }
                    })
                    return buffer - 0};
                set = function(data){
                    if(endpoint.access!=='rw'){
                        throw 'Error: Access ' + endpoint.access
                        return
                    }
                    buffer = new Int64LE(data)
                    self.fibre.set(endpoint.id, buffer, function(stale){})
                };
                break;
            case 'float':
                endpoint.length = 4
                buffer = Buffer.alloc(4); 
                get = function(    ){
                    self.fibre.get(endpoint.id,endpoint.length,function(data){
                        if(Buffer.isBuffer(data)){
                            buffer = check(data, endpoint.length)
                        }
                    })
                    return buffer.readFloatLE(0)
                };
                set = function(data){
                    if(endpoint.access!=='rw'){
                        throw 'Error: Access '  + endpoint.access
                        return
                    }
                    buffer.writeFloatLE(data, 0)
                    self.fibre.set(endpoint.id, buffer, function(stale){})
                };
                break;
            case 'double':
                endpoint.length = 8
                buffer = Buffer.alloc(8); 
                get = function(    ){
                    self.fibre.get(endpoint.id,endpoint.length,function(data){
                        if(Buffer.isBuffer(data)){
                            buffer = check(data, endpoint.length)
                        }
                    })
                    return buffer.readDoubleLE(0)};
                set = function(data){
                    if(endpoint.access!=='rw'){
                        throw 'Error: Access ' + endpoint.access
                        return
                    }
                    buffer.writeDoubleLE(data, 0)
                    self.fibre.set(endpoint.id, buffer, function(stale){})
                    
                };
                break;
            case 'endpoint_ref':
            case 'json':
            case 'string':
                buffer = Buffer.from(''); 
                endpoint.length = 512
                get = function(    ){
                    self.fibre.get(endpoint.id,endpoint.length,function(data){
                        if(Buffer.isBuffer(data)){
                            buffer = data
                        }
                    })
                    return buffer.toString()};
                set = function(data){ 
                    if(endpoint.access!=='rw'){
                        throw 'Error: Access ' + endpoint.access
                        return
                    }
                    buffer = Buffer.from(data); 
                    self.fibre.set(endpoint.id, buffer, function(stale){})

                    
                }
                break;
            case 'bool':
                endpoint.length = 1
                buffer = Buffer.alloc(1); 
                get = function(    ){
                    self.fibre.get(endpoint.id,endpoint.length,function(data){
                        if(Buffer.isBuffer(data)){
                            buffer = check(data, endpoint.length)
                        }
                    })
                    return Boolean(buffer.readUInt8(0));
                    
                }
                set = function(data){
                    if(endpoint.access!=='rw'){
                        throw 'Error: Access ' + endpoint.access
                        return
                    }
                    buffer.writeUInt8((+ data), 0);
                    self.fibre.set(endpoint.id, buffer, function(stale){})
                    
                    
                }
                break;
            default: 
                throw endpoint
            break;
                
        }
        Object.defineProperty(object, endpoint.name, { 
            get: get, 
            set: set
        });


        
    }
    function unmarshal(obj){
        return(JSON.parse(JSON.stringify(obj)))
    }
    
    self.enums = enums
    self.unmarshal = unmarshal
    self.fibre.on('connect',function(){
        if(!self.json_bytes){
            self.fibre.get(0,512,function(buffer){
                self.json_bytes = buffer
                self.emit('remoteObject', compile( JSON.parse(self.json_bytes.toString()) ))
            })
        }else{
                self.emit('remoteObject', compile( JSON.parse(self.json_bytes.toString()) ))
            }
            
    })

    return self
}

module.exports = odrive 
