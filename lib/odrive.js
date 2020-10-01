var events	= require('events');
var UInt64BE	= require("int64-buffer").Uint64BE
var UInt64LE	= require("int64-buffer").Uint64LE
var Int64BE	= require("int64-buffer").int64BE
var Int64L	= require("int64-buffer").int64LE
var fibre	= require('@primeeuler/fibre');
var enums	= require('./enums0.5.1.1.json')



function odrive(){
    var self           = new events.EventEmitter();
        self.fibre     = new fibre();
        self.endpoints = [];
    function compile(endpoints,parent,namespace){
        namespace  = namespace || '';
	parent 	   =  parent || '';
	var object = {};
        endpoints.forEach(function(endpoint){
	    //enumeration
	    var enum_path  = (namespace.split('_').join('.') + '.' + endpoint.name.split('_').join('.'))
		.split('.')
                .map( function(x) { return x.replace(/[0-9]/g,'') })
                .map( function(x,i,a) { if( x ==='config' || x === 'requested' || x === 'current' ){ return a[i-1] }else{ return x }})
	    var enum_name  = enum_path.slice(Math.max(enum_path.length-2,1 )).join('_')
	    var is_enum    = (['protocol','mode','type','error','state'].indexOf( enum_name.split('_').pop() ) >-1)
	    if( endpoint.type === 'int32' & is_enum ) { endpoint.enum = enums[enum_name]; }
            //serialization
	    if(!object[endpoint.name]){  object[endpoint.name] = {} }; 
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
