// functions that handle sending and receiving stuff to/from the server via
// a socket and updating the UI accordingly
$(function () {
    // helper function to keep values in the correct ranges
    function clamp(a, b, c) {
        return Math.max(b, Math.min(c, a));
    }

    const path = window.location.pathname;
    const pathParts = path.split('/');
    const mode = pathParts[2];
    const sessId = pathParts[3];
    const socket = io();
    let driverToken = '';
    let script = {};
    let scriptTimeouts = { 'left': 0, 'right': 0 };
    let timers = { 'left': 0, 'right': 0 };

    function script_next_step(channel) {
        try {
            const step = script[channel].shift();
            if (!step) {
                $('#status-message').text("Script complete");
                return;
            }
            timers[channel] = Math.floor(step['stamp'] / 1000);
            scriptTimeouts[channel] = setTimeout(function(){ apply_step(channel, step['message']) }, step['stamp']);
        } catch(e) {
            $('#status-message').text(`Invalid script, cannot run.  Error: ${e}`);
        }
    }

    function apply_step(channel, step) {
        if( window.console ) console.log("Step %s: %o", channel, step);
        const channelSel = '#' + channel + '-channel-column ';

        $(channelSel + 'input[name="volume"]').val(step['volume']);
        $(channelSel + 'input[name="frequency"]').val(step['freq']);
        $(channelSel + 'select[name="am-type"]').val(step['amType']);
        $(channelSel + 'input[name="am-depth"]').val(step['amDepth']);
        $(channelSel + 'input[name="am-frequency"]').val(step['amFreq']);
        $(channelSel + 'select[name="fm-type"]').val(step['fmType']);
        $(channelSel + 'input[name="fm-depth"]').val(step['fmDepth']);
        $(channelSel + 'input[name="fm-frequency"]').val(step['fmFreq']);
        $(channelSel + 'input[name="ramp-target"]').val(step['rampTarget']);
        $(channelSel + 'input[name="ramp-rate"]').val(step['rampRate']);
        $(channelSel + '.apply-btn').click();
        script_next_step(channel);
    }

    function step_timers() {
        let min = Object.values(timers).sort()[0]
        if (min < 0) min = 0;
        if (min == 0)
            $("#cancel-script").hide();
        else
            $("#cancel-script").show();

        $('#step-timer').text(min);
        timers['left'] -= 1;
        timers['right'] -= 1;
    }
    setInterval(step_timers, 1000);

    if (mode == 'play') {
        if (sessId == 'solo') {
            return;
        }

        let authorizedPlaying = false;
        // let the server know we want to join this session and display an error
        // message if it fails
        $('#status-message').text('Joined session with Session ID ' + sessId + '. To start riding, click the button below.');
        socket.emit('registerRider', { sessId: sessId });
        socket.on('riderRejected', function () {
            $('#status-message').text('Could not join session ' + sessId + '. Please check the Session ID.');
        });

        $('#initialize-audio').show();
        $('#initialize-audio a').click(function () {
            authorizedPlaying = true;
            socket.emit('requestLast', { sessId: sessId });
            $('#initialize-audio').hide();
        });

        // show traffic light container
        $('#traffic-light').show();
        // event listeners for traffic light system
        $(window).on('traffic-light', function () {
            const data = {
                sessId: sessId,
                color: $('#traffic-light button.active').data('traffic-light')
            };
            socket.emit('trafficLight', data);
            return false;
        });

        // ---RIDER---
        // receive events and populate input fields
        ['left', 'right'].forEach(function (channel) {
            socket.on(channel, function (msg) {
                if (!authorizedPlaying) {
                    return;
                }
                const channelSel = '#' + channel + '-channel-column ';
                $(channelSel + 'input[name="volume"]').val(clamp(msg.volume, 0, 100));
                $(channelSel + 'input[name="frequency"]').val(clamp(msg.freq, 100, 3000));
                $(channelSel + 'select[name="am-type"]').val(msg.amType).selectmenu('refresh');
                $(channelSel + 'input[name="am-depth"]').val(clamp(msg.amDepth, 0, 100));
                $(channelSel + 'input[name="am-frequency"]').val(clamp(msg.amFreq, 0, 100));
                $(channelSel + 'select[name="fm-type"]').val(msg.fmType).selectmenu('refresh');
                $(channelSel + 'input[name="fm-depth"]').val(clamp(msg.fmDepth, 0, 1000));
                $(channelSel + 'input[name="fm-frequency"]').val(clamp(msg.fmFreq, 0, 100));
                $(channelSel + 'input[name="ramp-rate"]').val(clamp(msg.rampRate, 0, 10));
                $(channelSel + 'input[name="ramp-target"]').val(clamp(msg.rampTarget, 0, 100));
                if (msg.active) {
                    applyChanges(channel);
                } else {
                    stopChannel(channel);
                }
            });
        });

        // receive pain events
        ['pain-left', 'pain-right'].forEach(function (channel) {
            socket.on(channel, function (msg) {
                const channelName = channel == 'pain-left' ? 'left' : 'right';
                executePain(channelName, msg);
            });
        });

        $('button.apply-btn').remove();
        $('button.pain-btn').remove();
        $('button.stop-btn').remove();
    } else {
        // ---DRIVER---
        $('#status-message').text('Attempting to register as driver of Session ID ' + sessId + '.');
        socket.emit('registerDriver', { sessId: sessId });

        socket.on('driverToken', function (msg) {
            driverToken = msg;
            const link = ('' + window.location).replace('/drive/', '/play/');
            const line1 = 'Registered successfully on the network! Driving session with Session ID ' + sessId + '.';
            const line2 = 'Send the following link to the people you want to drive:<br>' + '<strong>' + link + '</strong>';
            $('#status-message').html(line1 + '<br>' + line2);

            $('.save-load-bar').show();

            // initialize box that displays how many riders are connected and update it every 5 seconds
            $('#rider-count').show();
            setInterval(function () {
                socket.emit('getRiderCount', { sessId: sessId, driverToken: driverToken });
            }, 5000);

            socket.on('riderCount', function (msg) {
                // render traffic light bars, based on the status of the riders
                const total = msg.total;
                const bars = [
                    { colorClass: 'red', value: msg.R },
                    { colorClass: 'yellow', value: msg.Y },
                    { colorClass: 'green', value: msg.G },
                    { colorClass: 'none', value: msg.N }
                ];

                bars.forEach(function (bar) {
                    const element = document.querySelector(`.traffic-bar.${bar.colorClass}`);
                    element.style.width = `${total === 0 ? 0 : (bar.value / total) * 100}%`;
                });

                // update the rider count on the page
                $('#rider-count-number').text(total);
            });

            $('#save-session-messages').on('click', function() {
                socket.emit('getSessionMessages', { sessId: sessId, driverToken: driverToken });
            });

            $('#cancel-script').on('click', function() {
                try {
                    clearTimeout(scriptTimeouts['left']);
                    clearTimeout(scriptTimeouts['right']);
                    timers['left'] = 0;
                    timers['right'] = 0;
                    script = {};
                } catch(e) {
                  $('#status-message').text('Cancelled script');
                };
            });

            socket.on('sessionMessages', function(msg) {
                if (window.File && window.FileReader && window.FileList && window.Blob) {
                    let element = document.createElement('a');
                    element.setAttribute('href', 'data:application/json;charset=utf-8,' + encodeURIComponent(msg));
                    element.setAttribute('download', `${sessId}.json`);
                    element.style.display = 'none';
                    document.body.appendChild(element);
                    element.click();
                    document.body.removeChild(element);
                } else {
                    $('#messages-target').text(msg);
                    $('#status-message').text('The File APIs are not fully supported by your browser.');
                }
            });

            $("#load-file-picker").change(function(){
                if(this.files && this.files[0]) {
                    const reader = new FileReader();
                    reader.onload = function (e) {
                        try {
                            script = JSON.parse(e.target.result);
                            script_stamp = Date.now();
                            script_next_step('left');
                            script_next_step('right');
                        } catch(e) {
                            $('#status-message').html(`Error parsing script file: ${e}`);
                        }
                    };
                    reader.readAsText(this.files[0]);
                };
            });

        });

        socket.on('driverRejected', function () {
            $('#status-message').html('Someone else is already driving this session. Please create a new one.<br>Any changes you make will NOT be sent to riders.');
        });

        // set listeners to send events to the server
        ['left', 'right'].forEach(function (channel) {
            const channelSel = '#' + channel + '-channel-column ';

            // helper function to assemble the data we want to send to the server,
            // including all signal generation parameters
            const getDataToSend = function () {
                return {
                    sessId: sessId,
                    driverToken: driverToken,
                    active: true,
                    volume: parseFloat($(channelSel + 'input[name="volume"]').val()),
                    freq: parseFloat($(channelSel + 'input[name="frequency"]').val()),
                    amType: $(channelSel + 'select[name="am-type"]').val(),
                    amDepth: parseFloat($(channelSel + 'input[name="am-depth"]').val()),
                    amFreq: parseFloat($(channelSel + 'input[name="am-frequency"]').val()),
                    fmType: $(channelSel + 'select[name="fm-type"]').val(),
                    fmDepth: parseFloat($(channelSel + 'input[name="fm-depth"]').val()),
                    fmFreq: parseFloat($(channelSel + 'input[name="fm-frequency"]').val()),
                    rampTarget: parseFloat($(channelSel + 'input[name="ramp-target"]').val()),
                    rampRate: parseFloat($(channelSel + 'input[name="ramp-rate"]').val())
                };
            };

            // helper function to assemble the pain function data to send it to the server
            const getPainDataToSend = function () {
                return {
                    sessId: sessId,
                    driverToken: driverToken,
                    volume: 0.01 * parseFloat($('input[name="pain-volume"]').val()),
                    frequency: parseFloat($('input[name="pain-frequency"]').val()),
                    shockDuration: parseFloat($('input[name="pain-duration"]').val()),
                    timeBetweenShocks: parseFloat($('input[name="pain-time-between"]').val()),
                    numberOfShocks: parseInt($('input[name="pain-number"]').val()),
                };
            };

            // register event listeners for applying changes, stopping a channel and using
            // the pain tool (total 6 events, 3 per channel)
            $(window).on('applied-' + channel, function () {
                const data = getDataToSend();
                data.active = true;
                socket.emit(channel, data);
                return false;
            });

            $(window).on('stopped-' + channel, function () {
                const data = getDataToSend();
                data.active = false;
                socket.emit(channel, data);
                return false;
            });

            $(window).on('pain-' + channel, function () {
                const data = getPainDataToSend();
                socket.emit('pain-' + channel, data);
                return false;
            });
        });
    }

});;
