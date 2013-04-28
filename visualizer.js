var flow_map = [];
var SVG = null;
var play_timer = 0;
var svgSize = {cx : 600, cy : 600, x : 800, y: 600};
var play_ts = {"min": 0};
var play_servers = null;
var play_weight = {"min": Infinity, "max": -1};
var simulation_speed = 10;
var flow_types = {"Shuffle" : {"port" : 8080, "color": "blue"},
                  "DataNode" : {"port" : 50010, "color": "green"},
                  "NameNode" : {"port" : 9000, "color": "orange"}};
var cur_filters = {};

var node_mappings = {"10.200.0.2": "euc-nat",
"10.200.0.1": "eucboss",
"10.200.0.3": "euc01",
"10.200.0.4": "euc02",
"10.200.0.5": "euc03",
"10.200.0.6": "euc04",
"10.200.0.7": "euc05",
"10.200.0.8": "euc06",
"10.200.0.9": "euc07",
"10.200.0.10": "euc08",
"10.200.0.11": "euc09",
"10.200.0.12": "euc10",
"10.200.0.13": "euc11",
"10.200.0.14": "euc12",
"10.200.0.15": "euc13",
"10.200.0.16": "euc14",
"10.200.0.17": "euc15",
"10.200.0.18": "euc16",
"10.200.0.19": "euc17",
"10.200.0.20": "euc18",
"10.200.0.21": "euc19",
"10.200.0.22": "euc20"};

/*
 TODO: Take in node_mappings for ip -> node name
*/

function circleCoords(radius, steps, centerX, centerY) {
    var xValues = [centerX];
    var yValues = [centerY];
    var ret = [[centerX, centerY]];
    for (var i = 1; i < steps; i++) {
        var cur = [0, 0];
        cur[0] = (centerX + radius * Math.cos(2 * Math.PI * i /
                                              steps-Math.PI/2));
        cur[1] = (centerY + radius * Math.sin(2 * Math.PI * i /
                                              steps-Math.PI/2));
        ret[i] = cur;
   }
    ret[0][1] = ret[0][1] - radius;
    return ret;
}


function createServers(coords, rad, servers, pathEnd) {
    var numCircles = 10;
    var dataset = [];
    var server_sort = function(a,b) {
        if ( a == b) {
            return 0;
        }

        // Sort the last digit
        var tmp_a = a.split(".");
        var tmp_b = b.split(".");

        var int_a = parseInt(tmp_a[tmp_a.length-1]);
        var int_b = parseInt(tmp_b[tmp_b.length-1]);

        if (int_a > int_b) {
            return 1;
        } else {
            return -1;
        }
    };


    // Create the Dataset
    for (var server in servers) {
        if (servers.hasOwnProperty(server) && server != "size") {
            dataset.push(server);
        }
    }

    // Ensures that the servers are in incremental ordering
    dataset.sort(server_sort);

    var g_circles = SVG.append("g")
            .attr("class","circles");

    $.each(coords, function(i, d) {
        g_circles.append("circle")
            .attr('filter', 'url(#dropShadow)')
            .attr("class","circle")
            .attr("id", "circle" + i)
            .attr("r", 30)
            .attr("cx", d[0])
            .attr("cy", d[1])
	    .attr("style", "stroke-width:0")
	    .attr("opacity", .9)
            .text(dataset[i])
            .data(dataset[i]);

        SVG.append('text')
            .text(node_mappings[dataset[i]])
            .attr("class", "labels")
            .attr("x", d[0])
            .attr("y", d[1] + 4)
	    .attr("text-anchor", "middle")
            .attr('fill', 'black');
    });

    var circles = SVG.selectAll("circle")
            .data(dataset);

    for (var i = 0; i < circles[0].length; i++) {
        servers[dataset[i]] = pathEnd[i];
    }

    return servers;
}


/* buidFlowMap flows -> [flow1, flow2, ..., flowN]
 * This function is where the heavy lifting happens. We scroll through
 *  all the flows and build a relevent map of changes in flows over
 *  time.
*/
function buildFlowMap(flows) {
    var map = [];
    for ( var flow in flows ) {
        if (flows.hasOwnProperty(flow)) {
            var entry = {};
            var tags = flows[flow]["trace-tags"];
            if (tags.length > 0) {
                tags = tags[0];

                entry.jid = flows[flow].jid;
                entry.src = tags["source"];
                entry.src_port = tags["source_port"];
                entry.dst = tags["dest"];
                entry.dst_port = tags["dest_port"];
                entry.start = tags["timestamp"];

                /*Get the endTime*/
                var tstat = flows[flow]["tstat"];
                if (tstat.length <= 2) {
                    // 88th entry is the length of the request
                    var flow_len = parseInt(tstat[0][88]);
                    entry.end = entry.start + flow_len;

                    //8th entry for the size of the flow
                    var bytesTransfered = parseInt(tstat[0][8]);
                    var weight = Math.log(bytesTransfered/flow_len);
                    var line_weight = (((15 - 3)*(weight - play_weight.min))/
                        (play_weight.max -  play_weight.min)) + 3;

                    entry.weight = line_weight;
                }
                map.push(entry);
            }
        }
    }
    return map;
}

/* Alternate to flow map. Much faster*/
function buildChangeMap() {
    var map = {};
    for ( var flow in flows) {
        if (flows.hasOwnProperty(flow)) {
            var entry = {};
            var tags = flows[flow]["trace-tags"];
            if (tags.length > 0) {
                tags = tags[0];

                entry.jid = flows[flow].jid;
                entry.src = tags["source"];
                entry.src_port = tags["source_port"];
                entry.dst = tags["dest"];
                entry.dst_port = tags["dest_port"];
                entry.start = tags["timestamp"];

                /*Get the endTime*/
                var tstat = flows[flow]["tstat"];
                if (tstat.length <= 2) {
                    // 88th entry is the length of the request
                    var flow_len = parseInt(tstat[0][88]);
                    entry.end = entry.start + flow_len;
                }

                /* Deal with the starting entry change*/
                if (map[entry.start] == undefined) {
                    map[entry.start] = [entry];
                    for (var i = entry.start; i > 0; i-- ) {
                        if (map[i] != undefined) {
                            map[entry.start] = map[i].concat([entry]);
                        }
                    }
                } else {
                    map[entry.start] = map[entry.start].concat([entry]);
                }

                /*Deal with making sure the flow is removed at the end*/
                if (map[entry.end] == undefined) {
                    map[entry.end] = [];
                }
            }
        }
    }
    return map;
}

/*
 * processFile input_file_text -> creates simulation
 * This function is called once the whole file is read in. It gets
 * some details from the inputted json as well as initiates the
 * setup sequence
 */
function processFile(text){
    var flows = JSON.parse(text);

    if (SVG != null) {
        d3.select("#viz")[0][0].innerHTML = "";

        document.getElementById("time_slider").innerHTML = "";
        document.getElementById("speed_slider").innerHTML = "";

        flow_map = [];
        play_timer = 0;
        play_ts = {"min": 0};
        play_servers = null;
        play_weight = {"min": 9007199254740992, "max": -1};

    }
    var servers = getServers(flows);
    var time_stats = generateTimeStats(flows);


    //FIX: This could be the worst thing I have ever done
    play_ts = time_stats;
    play_servers = servers;

    /* TODO: I shouldn't need the flows in the setup, right?*/
    setup(servers, flows, time_stats);
}

/*
 * getTimeStats input -> {max_time : t1, min_time : t2}
 * This function is pretty straight forward, it generates the max and
 * minimum times of the traces. This should be put in sync with get
 *  servers, but I will worry about that later
 */
// TODO CHANGE NAME AND RETURN WEIGHT
function generateTimeStats(input) {
    var ret = {"min" : 1000000000000000, "max" : 0};
    for (var flow in input) {
        if (input.hasOwnProperty(flow)) {
            var timestamp = null;

            /* Checking to make sure it has a tags field and getting
             * the timestamp out*/
            var tags = input[flow]["trace-tags"];
            if (tags.length > 0) {
                timestamp = tags[0].timestamp;
                if (timestamp < ret["min"]) {
                    ret["min"] = timestamp;
                }
            }

            /* Checking to make sure there is the tstat field/ getting
             * max */

            var tstat = input[flow]["tstat"];
            if (tstat.length <= 2) {

                // 88th entry is the length of the request
                var flow_len = parseInt(tstat[0][88]);
                if ((timestamp + flow_len) > ret["max"]) {
                    ret["max"] = (timestamp + flow_len);
                }

                var bytesTransfered = parseInt(tstat[0][8]);
                var weight = Math.log(bytesTransfered/flow_len);

                //8th entry is the size

                if (play_weight.min > weight) {

                    play_weight.min = weight;
                } else if (play_weight.max < weight) {

                    play_weight.max = weight;
                }

            }
        }
    }
    return ret;
}

/*
 * getServers Input json -> {server1 : 1, server2 : 2 ... }
 * This function gets the servers from all of the flows. It also adds
 *  a size field to the object to get how many servers are used.
 */
function getServers(input) {
    var servers = {"size" : 0};
    for (var flow in input) {
        if (input.hasOwnProperty(flow)) {

            //Checking to make sure it has a tags field
            var tags = input[flow]["trace-tags"];
            if (tags.length > 0) {
                var src = tags[0].source;
                var dst = tags[0].dest;

                // Got to keep track of the size
                if (servers[src] != 1) {
                    servers.size += 1;
                    servers[src] = 1;
                }

                if (servers[dst] != 1) {
                    servers.size += 1;
                    servers[dst] = 1;
                }

            }
        }
    }
    return servers;
}

function drawFilters(){
    var dat = [];
    var curY = 40;
    for (var type in flow_types) {
        var tmp = {};
        tmp["name"] = type;
        tmp["port"] = flow_types[type].port;
        tmp["height"] = 40;
        tmp["width"] = 100;
        tmp["color"] = flow_types[type].color;
        tmp["x"] = svgSize.x - tmp.width;
        tmp["y"] = curY;
        curY += tmp.height+10;
        dat.push(tmp);
    }


    /*Create the Label for the filters*/
    SVG.append("svg:text")
        .attr("class", "filterLabel")
        .attr("x", function() { return svgSize.x;})
        .attr("y", function() { return 10;})
        .attr("dx", function() {return -100/2;})
        .attr("dy", "1.2em")
        .attr("text-anchor", "middle")
        .text("Flow Filters:")
        .attr("fill", "black");


    SVG.selectAll(".all_filters")
        .data(dat)
        .enter()
        .append("g")
        .attr("class", "all_filters")
        .on("click", function(target) {
            var ele = d3.select(this)[0][0];
            var rect = ele.getElementsByClassName("filter_rect")[0];
            var port = flow_types[target.name].port;

            if (cur_filters[port] == 1) {
                /*Filter was enabled*/
                delete cur_filters[port];
                rect.setAttribute("opacity", 0.6);

            } else {
                /*Filter wasn't enabled*/
                cur_filters[port] = 1;
                rect.setAttribute("opacity", 0.1);
            }
            var value = $("#time_slider").slider("option", "value");
            var curFlows = currentFlows(value, play_ts);

            drawFlows(curFlows, play_servers);
        })
        .append("svg:rect")
        .attr("class", "filter_rect")
        .attr("x", function(datum) {return datum.x;})
        .attr("y", function(datum) { return datum.y;})
        .attr("height", function(datum){ return datum.height;})
        .attr("width", function(datum){ return datum.width;})
        .attr("rx", 15)
        .attr("ry", 15)
        .attr("opacity", 0.6)
        .text(function(datum){return datum.name;})
        .attr("fill", function(datum){ return datum.color;});

    d3.selectAll(".all_filters")
        .append("svg:text")
        .attr("class", "noSelect")
        .attr("x", function(datum) { return datum.x + datum.width;})
        .attr("y", function(datum) { return datum.y + datum.height/2 - 15;})
        .attr("dx", function(datum) {return -datum.width/2;})
        .attr("dy", "1.2em")
        .attr("text-anchor", "middle")
        .text(function(datum){return datum.name;})
        .attr("fill", "black");

}

function setup(servers, flows, time_stats) {

    // Initialize the canvas
    SVG = d3.select("#viz").append("svg")
            .attr("width", svgSize.x)
            .attr("height", svgSize.y);

    // Build the flow map
    flow_map = buildFlowMap(flows);

    // Info About Servers
    var numServers = servers.size;
    var serverCircleRadius = 250;
    var serverRadius = 35;

    /*Add the text with the time*/
    SVG.append("text")
        .attr("x", function(d){return svgSize.cx - 150;})
        .attr("y", function(d){return svgSize.cy - 25;})
        .text("Time (ms):");
    SVG.append("text")
        .attr("class","time_val")
        .attr("x", function(d){return svgSize.cx - 140;})
        .attr("y", function(d){return svgSize.cy - 10;})
        .text("0");

    drawFilters();

    // Initialize definitions
    createDefs(SVG.append('svg:defs'));

    // Create the SVG servers
    var pathEndpoints = circleCoords(serverCircleRadius- serverRadius,
                                    numServers, svgSize.cx/2, svgSize.cy/2);
    var serverLayout = circleCoords(serverCircleRadius, numServers,
                                    svgSize.cx/2, svgSize.cy/2);
    servers = createServers(serverLayout, serverRadius, servers, pathEndpoints);

    // Setup Sliders
    setupTimeSlider(SVG, time_stats, servers);
    setupSpeedSlider();
}

function createDefs(defs) {
    var dropShadowFilter = defs.append('svg:filter')
            .attr('id', 'dropShadow');
    dropShadowFilter.append('svg:feGaussianBlur')
        .attr('in', 'SourceAlpha')
        .attr('stdDeviation', 1);
    dropShadowFilter.append('svg:feOffset')
        .attr('dx', 0)
        .attr('dy', 1)
        .attr('result', 'offsetblur');
    var feMerge = dropShadowFilter.append('svg:feMerge');
    feMerge.append('svg:feMergeNode');
    feMerge.append('svg:feMergeNode')
        .attr('in', "SourceGraphic");
}


/* currentFlows time_stats -> currentFlows */
function currentFlows(value,ts) {
    var curFlows = [];

    /* Find the flows that are currently active */
    for (var i = 0; i < flow_map.length; i++) {
        /* Check to see if the time is correct*/
        if ((value + ts["min"]) < flow_map[i].end && (value + ts["min"]) >= flow_map[i].start) {

            /*Check to see if it's filtered*/
            if(cur_filters[flow_map[i].dst_port] == null &&
               cur_filters[flow_map[i].src_port] == null){
                curFlows.push(flow_map[i]);
            }
        }
    }
    return curFlows;
}

/* FIX: Pick up here, Also, use the fucking change map*/
function drawFlows(curFlows, servers) {

    // Remove the previous flows
    var lines = d3.selectAll("path");

    if (lines[0].length > 0) {
        lines.data([]).exit().remove();
    }

    for (var i = 0; i < curFlows.length; i++) {
        var src = servers[curFlows[i].src];
        var dst = servers[curFlows[i].dst];

        var lineData = [{'x': parseInt(src[0]), //Src
                         'y': parseInt(src[1])},
                        {'x': svgSize.cx/2, // Center
                         'y': svgSize.cy/2},
                        {'x': parseInt(dst[0]), // Dst
                         'y': parseInt(dst[1])}];

        var lineFunction = d3.svg.line()
                .x(function(d) { return d.x; })
                .y(function(d) { return d.y; })
                .interpolate("bundle");

	var color = "red"; /*NOTE: Some that don't hit any of the colors */
	if (curFlows[i]["dst_port"] == flow_types["Shuffle"].port ||
            curFlows[i]["src_port"] == flow_types["Shuffle"].port) {
	    // Shuffle
	    color = flow_types["Shuffle"].color;
	} else if (curFlows[i]["dst_port"] == flow_types["DataNode"].port ||
                   curFlows[i]["src_port"] == flow_types["DataNode"].port) {
	    // DataNode
	    color = flow_types["DataNode"].color;
	} else if (curFlows[i]["dst_port"] == flow_types["NameNode"].port ||
                   curFlows[i]["src_port"] == flow_types["NameNode"].port) {
	    // NameNode
	    color = flow_types["NameNode"].color;
	}

        SVG.append("path")
            .attr("d", lineFunction(lineData))
            .attr("stroke", color)
            .attr("opacity", .5)
            .attr("stroke-width", curFlows[i].weight)
            .attr("fill", "none")
            .on("mouseover", function() {draw_box(d3.select(this));})
            .on("mouseover", remove_box);
    }
}

function remove_box() {
    console.log("whats up bitches");
}

function draw_box(s) {
    console.log(d3.select(s));
}

function setup_play() {
    var max = $("#time_slider").slider("option", "max");
    if (play_timer == 0) {
        //console.log(play_timer);
        play_timer = setInterval(function(){ play(max);}, simulation_speed);
    } else {
        //console.log("Cant setup, it already exists");
    }
}

function abort_play() {
    clearInterval(play_timer);
    play_timer = 0;
}

function play(end_time) {
    var value = $("#time_slider").slider("option", "value");

    if (value < end_time) {
        $("#time_slider").slider("value", (value+1));
        d3.selectAll("text.time_val").text(value+1);
    } else {
        clearInterval(play_timer);
        play_timer=0;
    }
    var curFlows = currentFlows(value, play_ts);
    drawFlows(curFlows, play_servers);
}

function setupSpeedSlider() {
   // TODO: Should I just make the value step bigger?
    $(function() {
        $( "#speed_slider" ).slider({
            range: "max",
            min: .001,
            max: 30,
            step:.001,
            value: 10,
            slide: function( event, ui ) {
                if (play_timer != 0) {
                    abort_play();
                    document.getElementById("speed_slider_value").innerText
                        = ui.value + " ms";

                    simulation_speed = ui.value;
                    setup_play();
                } else {
                    document.getElementById("speed_slider_value").innerText
                        = ui.value + " ms";
                    simulation_speed = ui.value;
                }
            }
        });
    });
}

function setupTimeSlider(SVG, ts, servers) {
    $(function() {
        $("#button_bar")[0].style.display = "block";
        $( "#time_slider" ).slider({
            range: "max",
            min: 0,
            max: ts["max"] - ts["min"],
            value: 1,
            slide: function( event, ui ) {
                d3.selectAll("text.time_val").text(ui.value+1);
                var curFlows = currentFlows(ui.value, ts);
                drawFlows(curFlows, servers);
            }
        });
    });
}
