var instance_skel = require('../../instance_skel');
var udp           = require('../../udp');
var debug;
var log;


function instance(system, id, config) {
   var self = this;

   // super-constructor
   instance_skel.apply(this, arguments);

   self.actions(); // export actions

   return self;
}

instance.prototype.init_udp = function() {
        var self = this;

        if (self.config.ipaddress !== undefined) {
           self.udp = new udp(self.config.ipaddress, self.config.port);
           


           self.udp.on('status_change', function (status, message) {
              self.status(status, message);
           });
           
           self.udp.on('data', function (data) {
              //self.status(self.STATE_OK);
              self.log('info',"SCTE104 Inserter Response: " + data);
           });
        }
};

instance.prototype.updateConfig = function(config) {
   var self = this;

   self.config = config;
   
   if (self.udp !== undefined) {
      self.udp.destroy();
      delete self.udp;
   }
   
   self.actions();
   self.init_udp();
}

instance.prototype.init = function() {
   var self = this;

   self.status(self.STATE_OK);

   debug = self.debug;
   log = self.log;
   self.init_udp();
   self.last_ad_event_id = 1;
   self.break_ended = true;
   self.last_splice_event_id = 1;
   self.last_program_event_id = 1;
   self.last_break_event_id = 1;
   self.last_program_upid = "";
   self.last_ad_flags = {
      'delivery_not_restricted': true,
      'web_allowed': true,
      'no_regional_blackout': true,
      'archive_allowed': true,
      'Device restriction':3
   };
   self.last_break_flags = {
      'delivery_not_restricted': true,
      'web_allowed': true,
      'no_regional_blackout': true,
      'archive_allowed': true,
      'Device restriction':3
   };
   self.last_prog_flags = {
      'delivery_not_restricted': true,
      'web_allowed': true,
      'no_regional_blackout': true,
      'archive_allowed': true,
      'device_restriction':3
   };
   self.breakEndTimerId = 0;
   self.break_extend_operations = [];
   self.timerStartTime = Date.now();
   self.sendScte = true;
}

// Return config fields for web config
instance.prototype.config_fields = function () {
   var self = this;
   return [
      {
         type: 'text',
         id: 'info',
         width: 12,
         label: 'Information',
         value: 'This module will send a SCTE104 command to a Crystal Server.'
      },
      {
         type: 'textinput',
         id: 'ipaddress',
         label: 'IP Address',
         width: 4
      },
      {
         type: 'number',
         id: 'port',
         label: 'UDP Port',
         width: 4,
         min:1,
         max:50000,
         default: 14011
      },
      {
         type: 'number',
         id: 'insert_line',
         label: 'VANC Line',
         width: 4,
         min: 1,
         max: 20,
         default: 13
      }
   ]
}

instance.prototype.save_flags = function(flags, options) {
   flags.delivery_not_restricted = options.delivery_not_restricted;
   flags.web_allowed = options.web_allowed;
   flags.no_regional_blackout = options.no_regional_blackout;
   flags.archive_allowed = options.archive_allowed;
   flags.device_restriction = options.device_restriction;
}

// When module gets deleted
instance.prototype.destroy = function() {
   var self = this;
   
   if (self.udp !== undefined) {
      self.udp.destroy();
   }
   debug("destroy");
}

instance.prototype.actions = function(system) {
   var self = this;

   self.setActions({

      'ad_start': {
         label: 'Ad Start',
         options: [
            {
               type: 'number',
               label: 'Duration (seconds)',
               id: 'duration',
               min: 0,
               max: 600,
               default: 30
            },
            {
               type: 'number',
               label: 'Preroll (ms)',
               id: 'preroll',
               min: 0,
               max: 10000,
               default: 0
            },
            {
               type: 'checkbox',
               label: 'Delivery not restricted',
               id: 'delivery_not_restricted',
               default: false
            },
            {
               type: 'checkbox',
               label: 'Allow web delivery',
               id: 'web_allowed',
               default: false
            },
            {
               type: 'checkbox',
               label: 'No regional blackout',
               id: 'no_regional_blackout',
               default: true
            },
            {
               type: 'checkbox',
               label: 'Archive allowed',
               id: 'archive_allowed',
               default: true
            },
            {
               type: 'number',
               label: 'Device restriction',
               id: 'device_restriction',
               default: 3,
            },
         ]
      },
      'ad_end': {
         label: 'Ad End',
         options: [
            {
               type: 'number',
               label: 'Preroll (ms)',
               id: 'preroll',
               min: 0,
               max: 10000,
               default: 0
            }
         ]
      },
      'splice_start': {
         label: 'Splice Start',
         options: [
            {
               type: 'number',
               label: 'Duration (seconds)',
               id: 'duration',
               min: 0,
               max: 600,
               default: 30
            },
            {
               type: 'number',
               label: 'Preroll (ms)',
               id: 'preroll',
               min: 0,
               max: 10000,
               default: 0
            }
         ]
      },
      'splice_end': {
         label: 'Splice End',
         options: [
            {
               type: 'number',
               label: 'Preroll (ms)',
               id: 'preroll',
               min: 0,
               max: 10000,
               default: 0
            }
         ]
      },
      'prog_start': {
         label: 'Program Start',
         options: [
            {
               type: 'textinput',
               label: 'UPID',
               id: 'program_upid'
            },
            {
               type: 'number',
               label: 'Duration (seconds)',
               id: 'duration',
               min: 0,
               max: 21600, // 6 hours
               default: 3600
            },
            {
               type: 'number',
               label: 'Preroll (ms)',
               id: 'preroll',
               min: 0,
               max: 10000,
               default: 4000
            },
            {
               type: 'checkbox',
               label: 'Delivery not restricted',
               id: 'delivery_not_restricted',
               default: true
            },
            {
               type: 'checkbox',
               label: 'Allow web delivery',
               id: 'web_allowed',
               default: true
            },
            {
               type: 'checkbox',
               label: 'No regional blackout',
               id: 'no_regional_blackout',
               default: true
            },
            {
               type: 'checkbox',
               label: 'Archive allowed',
               id: 'archive_allowed',
               default: true
            },
            {
               type: 'number',
               label: 'Device restriction',
               id: 'device_restriction',
               default: 3,
            },
         ]
      },
      'prog_end': {
         label: 'Program End'
      },
      'break_start': {
         label: 'Break Start',
         options: [
            {
               type: 'number',
               label: 'Duration (seconds)',
               id: 'duration',
               min: 0,
               max: 600,
               default: 60
            },
            {
               type: 'number',
               label: 'Preroll (ms)',
               id: 'preroll',
               min: 0,
               max: 10000,
               default: 4000
            },
            {
               type: 'checkbox',
               label: 'Delivery not restricted',
               id: 'delivery_not_restricted',
               default: false
            },
            {
               type: 'checkbox',
               label: 'Allow web delivery',
               id: 'web_allowed',
               default: false
            },
            {
               type: 'checkbox',
               label: 'No regional blackout',
               id: 'no_regional_blackout',
               default: true
            },
            {
               type: 'checkbox',
               label: 'Archive allowed',
               id: 'archive_allowed',
               default: true
            },
            {
               type: 'number',
               label: 'Device restriction',
               id: 'device_restriction',
               default: 3,
            },
         ]
      },   
      'break_end': {
         label: 'Break End',
         options: [
            {
               type: 'number',
               label: 'Preroll (ms)',
               id: 'preroll',
               min: 0,
               max: 10000,
               default: 4000
            }
         ]
      },
      'break_extend': {
         label: 'Break Extend',
         options: [
            {
               type: 'number',
               label: 'Duration (seconds)',
               id: 'duration',
               min: 0,
               max: 600,
               default: 60
            },
            {
               type: 'number',
               label: 'Preroll (ms)',
               id: 'preroll',
               min: 0,
               max: 10000,
               default: 4000
            },
            {
               type: 'checkbox',
               label: 'Delivery not restricted',
               id: 'delivery_not_restricted',
               default: false
            },
            {
               type: 'checkbox',
               label: 'Allow web delivery',
               id: 'web_allowed',
               default: false
            },
            {
               type: 'checkbox',
               label: 'No regional blackout',
               id: 'no_regional_blackout',
               default: true
            },
            {
               type: 'checkbox',
               label: 'Archive allowed',
               id: 'archive_allowed',
               default: true
            },
            {
               type: 'number',
               label: 'Device restriction',
               id: 'device_restriction',
               default: 3,
            }
         ]
      },
      'break_timer_cancel': { // cancels break timer
         label: 'Break Cancel',
      }
   });
   
}

instance.prototype.action = function(action) {
   var self = this;
   //var cmd;

   if ( (self.config.ipaddress !== undefined) && (self.config.ipaddress.length > 0) ) {
      //cmd = 'http://' + self.config.ipaddress + '/webadmin/?rq=system-api&obj=ioprt&path=';
   }
   else {
      self.log('error', 'IP address not set');
      self.status(self.STATUS_ERROR, 'IP Address Not Set');
      return;
   }

   var _operations = [{}];
   if((action.action == 'ad_start') || (action.action == 'ad_end') || (action.action == 'splice_start') || (action.action == 'splice_end') || (action.action == 'prog_start') || (action.action) == 'prog_end' || (action.action == 'break_start') || (action.action == 'break_end') || (self.trigger_break_extend && action.action !='break_extend')) {
      //cmd += 'send_scte' + self.config.channel;
      if((action.action == 'ad_start') || (action.action == 'ad_end')){
         _operations = [{opID: 0x0104, pre_roll_time: action.options.preroll}];
         var ad_upid = "";
         var ad_upid_type = 0x00;
         if((action.action == 'ad_start')){
            self.last_ad_event_id++;
            _operations.push({ 
               opID: 0x010B, // segmentation_descriptor
               segmentation_event_id: self.last_ad_event_id,
               segmentation_type_id: 0x30, // Provider Ad Start
               segmentation_upid_type: ad_upid_type,
               segmentation_upid: ad_upid,
               duration: action.options.duration, //seconds
               delivery_not_restricted_flag: action.options.delivery_not_restricted,
               web_delivery_allowed_flag: action.options.web_allowed,
               no_regional_blackout_flag: action.options.no_regional_blackout,
               archive_allowed_flag: action.options.archive_allowed,
               device_restrictions: action.options.device_restriction
            });
            self.save_flags(self.last_ad_flags, action.options);
         }
         else if ((action.action == 'ad_end')){
            _operations.push({ 
               opID: 0x010B, // segmentation_descriptor
               segmentation_event_id: self.last_ad_event_id,
               segmentation_type_id: 0x31, // Provider Ad End
               segmentation_upid_type: ad_upid_type,
               segmentation_upid: ad_upid,
               delivery_not_restricted_flag: self.last_ad_flags.delivery_not_restricted,
               web_delivery_allowed_flag: self.last_ad_flags.web_allowed,
               no_regional_blackout_flag: self.last_ad_flags.no_regional_blackout,
               archive_allowed_flag: self.last_ad_flags.archive_allowed,
               device_restrictions: self.last_ad_flags.device_restriction
            });
         }
      }
      else if((action.action == 'splice_start')){
         self.last_splice_event_id++;
         var splice_duration = action.options.duration * 10;
         var splice_type = 1;
         if(action.options.preroll == 0){
            splice_type = 2;
         }
         _operations = [{ opID: 0x0101, splice_insert_type: splice_type, break_duration: splice_duration, pre_roll_time: action.options.preroll, splice_event_id: self.last_splice_event_id }];   
      }
      else if(action.action == 'splice_end'){
         var splice_type = 3;
         if(action.options.preroll == 0){
            splice_type = 4;
         }
         _operations = [{ opID: 0x0101, splice_insert_type: splice_type, pre_roll_time: action.options.preroll, splice_event_id: self.last_splice_event_id }];
      }
      else if((action.action == 'prog_start') || (action.action == 'prog_end')){
         _operations = [{opID: 0x0104, pre_roll_time: action.options.preroll}];
         var prog_upid_type = 0x01;
         if((action.action == 'prog_start')){
            if((self.last_program_upid.length > 0) && (self.last_program_upid != action.options.program_upid)){  //If a program with a different upid is started close out the previous program
               _operations.push({ 
               opID: 0x010B, // segmentation_descriptor
                  segmentation_event_id: self.last_program_event_id,
                  segmentation_type_id: 0x11, // Program End
                  segmentation_upid_type: prog_upid_type,
                  segmentation_upid: self.last_program_upid,
                  segment_num: 1,
                  segments_expected: 1,
                  delivery_not_restricted_flag: self.last_prog_flags.delivery_not_restricted,
                  web_delivery_allowed_flag: self.last_prog_flags.web_allowed,
                  no_regional_blackout_flag: self.last_prog_flags.no_regional_blackout,
                  archive_allowed_flag: self.last_prog_flags.archive_allowed,
                  device_restrictions: self.last_prog_flags.device_restriction           
               });

            }
            self.last_program_event_id++;
            self.last_program_upid = action.options.program_upid;
            
            _operations.push({ 
               opID: 0x010B, // segmentation_descriptor
               segmentation_event_id: self.last_program_event_id,
               segmentation_type_id: 0x10, // Program Start
               segmentation_upid_type: prog_upid_type,
               segmentation_upid: action.options.program_upid,
               duration: action.options.duration, //seconds
               segment_num: 1,
               segments_expected: 1,
               delivery_not_restricted_flag: action.options.delivery_not_restricted,
               web_delivery_allowed_flag: action.options.web_allowed,
               no_regional_blackout_flag: action.options.no_regional_blackout,
               archive_allowed_flag: action.options.archive_allowed,
               device_restrictions: action.options.device_restriction
            });
            self.save_flags(self.last_prog_flags, action.options);
         }
         else if ((action.action == 'prog_end')){
            _operations.push({ 
               opID: 0x010B, // segmentation_descriptor
               segmentation_event_id: self.last_program_event_id,
               segmentation_type_id: 0x11, // Program End
               segmentation_upid_type: prog_upid_type,
               segmentation_upid: self.last_program_upid,
               segment_num: 1,
               segments_expected: 1,
               delivery_not_restricted_flag: self.last_prog_flags.delivery_not_restricted,
               web_delivery_allowed_flag: self.last_prog_flags.web_allowed,
               no_regional_blackout_flag: self.last_prog_flags.no_regional_blackout,
               archive_allowed_flag: self.last_prog_flags.archive_allowed,
               device_restrictions: self.last_prog_flags.device_restriction          
            });
            self.last_program_upid = "";
         }
      } 
      else if((action.action == 'break_start') || (action.action == 'break_end') || self.trigger_break_extend){
         if(action.action == 'break_end' && self.breakEndTimerId && self.getTimeLeft() > 4000) { // if early break termination triggered
            self.trigger_break_extend = false; // cancel break extend with break end
         }
         if ((action.action == 'break_end' || self.trigger_break_end) && (!self.trigger_break_extend)){ // if break_end 
            var timeleft = self.getTimeLeft();
            if(action.action == 'break_end' && self.breakEndTimerId && timeleft < 4000 && timeleft > 0) return;
            if(self.breakEndTimerId && timeleft > 4000) self.sendScte = true;
            else self.sendScte = false;
            debug('break end triggered');
            self.cancel_timer(); // end break early
            
            _operations = [{opID: 0x0104, pre_roll_time: action.options.preroll}];
            var break_upid = "";
            var break_upid_type = 0x00;
            _operations.push({
               opID: 0x010B, // segmentation_descriptor
               segmentation_event_id: self.last_break_event_id,
               segmentation_type_id: 0x31, // Provider Ad End
               segmentation_upid_type: break_upid_type,
               segmentation_upid: break_upid,
               delivery_not_restricted_flag: true,
               web_delivery_allowed_flag: true,
               no_regional_blackout_flag: self.last_break_flags.no_regional_blackout,
               archive_allowed_flag: self.last_break_flags.archive_allowed,
               device_restrictions: self.last_break_flags.device_restriction
            });
            
            self.break_ended = true;
            self.trigger_break_end = false;
            self.breakEndTimerId = 0; // disable timer id
         }
         else if (self.trigger_break_extend) { // if break extend
            _operations = self.break_extend_operations;
            
            var new_action = {};
            new_action.action = 'break_end';
            new_action.options = {};
            new_action.options.preroll = 4000;
            var new_duration = self.break_extend_operations[self.break_extend_operations.length - 1].duration;
            
            self.timerStartTime = Date.now();
            self.breakEndTimerId = setTimeout(() => {
               debug("timeout called");
               this.trigger_break_end = true;
               this.action(new_action);
               this.breakEndTimerId = 0;
            }, new_duration * 1000);
            self.trigger_break_extend = false;
            self.break_extend_operations = [];
         }
         else if((action.action == 'break_start') && !self.trigger_break_extend) {         
            if(self.trigger_break_extend || !self.break_ended) return; // don't allow break start if break haven't ended
            // self.cancel_timer(); // can be taken out
            _operations = [{opID: 0x0104, pre_roll_time: action.options.preroll}]; // initialize operations
            var break_upid = "";
            var break_upid_type = 0x00;
            if(!self.break_ended){  //If a program with a different upid is started close out the previous program
               _operations.push({ 
                  opID: 0x010B, // segmentation_descriptor
                  segmentation_event_id: self.last_break_event_id, // use last break event id to close previous break event
                  segmentation_type_id: 0x31, // Provider Ad End
                  segmentation_upid_type: break_upid_type,
                  segmentation_upid: break_upid,
                  delivery_not_restricted_flag: true,
                  web_delivery_allowed_flag: true,
                  no_regional_blackout_flag: self.last_break_flags.no_regional_blackout,
                  archive_allowed_flag: self.last_break_flags.archive_allowed,
                  device_restrictions: self.last_break_flags.device_restriction
               });
            }
            self.last_break_event_id++;
            _operations.push({ 
               opID: 0x010B, // segmentation_descriptor
               segmentation_event_id: self.last_break_event_id,
               segmentation_type_id: 0x30, // Provider Ad Start
               segmentation_upid_type: break_upid_type,
               segmentation_upid: break_upid,
               duration: action.options.duration, //seconds
               delivery_not_restricted_flag: action.options.delivery_not_restricted,
               web_delivery_allowed_flag: action.options.web_allowed,
               no_regional_blackout_flag: action.options.no_regional_blackout,
               archive_allowed_flag: action.options.archive_allowed,
               device_restrictions: action.options.device_restriction
            });
            self.save_flags(self.last_break_flags, action.options);
            self.break_ended = false;
            
            self.timerStartTime = Date.now();
            self.breakEndTimerId = setTimeout(() => {
               debug("timeout called");
               this.trigger_break_end = true;
               this.action(action);
               this.breakEndTimerId = 0;
            }, action.options.duration * 1000);
         }
         
      } 

      var body  = {actions:[{scte104: {opID: 0xFFFF, operations: _operations}, line: self.config.insert_line}]};
            
      if (body !== undefined && self.sendScte) {
         debug("Sending ", JSON.stringify(body), "to", self.config.ipaddress);         
         if (self.udp !== undefined) {
            self.udp.send(JSON.stringify(body));
            
         }
         else{
            self.log('error', 'UDP Not Defined');
            self.status(self.STATUS_ERROR);
         }
      }
      self.sendScte = true;
      
   }
   else if((action.action == 'break_timer_cancel')) {
      self.cancel_timer();
      self.break_ended = true;
   }
   else if(action.action == 'break_extend') {
      if(self.breakEndTimerId && self.getTimeLeft() < 4000) return;
      if(!self.break_ended) {
         var break_upid = "";
         var break_upid_type = 0x00;
         if(self.break_extend_operations.length === 0) {
            self.break_extend_operations.push({opID: 0x0104, pre_roll_time: action.options.preroll});
            self.break_extend_operations.push({ 
               opID: 0x010B, // segmentation_descriptor
               segmentation_event_id: self.last_break_event_id,
               segmentation_type_id: 0x31, // Provider Ad End
               segmentation_upid_type: break_upid_type,
               segmentation_upid: break_upid,
               delivery_not_restricted_flag: true,
               web_delivery_allowed_flag: true,
               no_regional_blackout_flag: self.last_break_flags.no_regional_blackout,
               archive_allowed_flag: self.last_break_flags.archive_allowed,
               device_restrictions: self.last_break_flags.device_restriction
            });
            self.last_break_event_id++;
         }

         else self.break_extend_operations.pop(); // replace last ad start with new arguments

         self.break_extend_operations.push({
            opID: 0x010B, // segmentation_descriptor
            segmentation_event_id: self.last_break_event_id,
            segmentation_type_id: 0x30, // Provider Ad Start
            segmentation_upid_type: break_upid_type,
            segmentation_upid: break_upid,
            duration: action.options.duration, //seconds
            delivery_not_restricted_flag: action.options.delivery_not_restricted,
            web_delivery_allowed_flag: action.options.web_allowed,
            no_regional_blackout_flag: action.options.no_regional_blackout,
            archive_allowed_flag: action.options.archive_allowed,
            device_restrictions: action.options.device_restriction
         });
         self.save_flags(self.last_break_flags, action.options);
         self.break_ended = false;
         self.trigger_break_extend = true;
         self.trigger_break_end = false;
      }
      else debug('Not in Break');
   }
}


instance.prototype.getTimeLeft = function() {
   debug('time left: ', this.timerStartTime + this.breakEndTimerId._idleTimeout - Date.now());
   return (this.timerStartTime + this.breakEndTimerId._idleTimeout - Date.now());
}

instance.prototype.cancel_timer = function(){
   if(this.breakEndTimerId) {
      debug(`timer ${this.breakEndTimerId} for break end ${this.last_break_event_id} cancelled.`);
      clearTimeout(this.breakEndTimerId);
      this.breakEndTimerId = 0;
   }
   else 
      debug('No timer id available');
}

instance_skel.extendedBy(instance);
exports = module.exports = instance;
