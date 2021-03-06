var flow_map = [];
var SVG = null;
var play_timer = 0;
var svgSize = {cx : 700, cy : 675, x : 1000, y: 900};
var play_ts = {"min": 0};
var play_servers = null;
var play_weight = {"min": Infinity, "max": -1};
var simulation_speed = 10;
var flow_types = {"shuffle" : {"port" : 8080, "color": "black"},
                  "datanode" : {"port" : 50010, "color": "gray"},
                  "namenode" : {"port" : 9000, "color": "blue"}};
// FIX: Get this shit under control
var tmp_flow_types_hack = {"shuffle" : {"port" : 8080, "color": "black"},
                           "datanode" : {"port" : 50010, "color": "gray"},
                           "namenode" : {"port" : 9000, "color": "blue"},
                           "application_1367864756511_0004":{"color":"red"},
                           "application_1367864756511_0003":{"color":"red"},
                           "application_1367864756511_0002":{"color":"red"},
                           "application_1367864756511_0001":{"color":"red"},
                           "application_1367807925576_0004":{"color":"red"},
                           "application_1367807925576_0003":{"color":"red"},
                           "application_1367807925576_0002":{"color":"red"},
                           "resourcemanager": {"color":"cyan"},
                           "nodemanager":{"color":"yellow"},
                           "unknown": {"color":"brown"},
                          "historyserver":{"color":"green"}};

var cur_filters = {};
var utilization_info = {};

// Data
var util_data = {};

var hadoopPathTooltip = PathTooltip();
var EPOCH_END = 1367697119;
var EPOCH_START = 1367696959;
var swim_map = {};


var node_mappings = {
    "10.200.0.2": "euc-nat",
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
    "10.200.0.22": "euc20"
};

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


function createServers(coords, rad, servers, pathEnd, linkEnd, linkStart) {
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
        servers[dataset[i]] = {path: pathEnd[i], utilEnd: linkEnd, utilStart: linkStart};
    }

    return servers;
}

function cleanUtilData() {
    var newUtilData = {};
    for(var key in util_data){
        var newKey = Math.floor(parseFloat(key)*1000);

        var ports = util_data[key];

        /*TODO: That 20 really shouldn't be hardcoded*/
        var newPorts = [];
        for (var i=1; i < 21; i++) {
            newPorts[i] = {"in": ports[i.toString()][0], "out":ports[i.toString()][1]};
        }
        newUtilData[newKey] = newPorts;
    }
    util_data = newUtilData;
}

function createUtilization(servers) {
    cleanUtilData();

    var g_util = SVG.append("g")
            .attr("class", "util");
    var count = 0;
    var circum = 2*Math.PI*(250 + 35);
    var lineWidth = 10;
    var lineHeight = 30;

    var deg = ((lineWidth+ 1)/(circum/360))*(Math.PI/180);
    $.each(servers, function(i,d) {
        if (i != "size") {

            var x1 = svgSize.cx/2;
            var y1 = svgSize.cy/2;

            var dx = x1 - d.utilStart[count][0];// - d.utilEnd[count][0];
            var dy = y1 - d.utilStart[count][1];// - d.utilEnd[count][1];
            var stheta = Math.atan2(dy, dx);
            stheta *= 180/Math.PI;
            stheta += 90;

            var x2 = d.utilStart[count][0];
            var y2 = d.utilStart[count][1];

            var sTransform = "translate("+x2+","+y2+") rotate("+stheta+")";
            g_util.append("svg:rect")
                .attr("class", "util")
                .attr("id", i +"S")
                .attr("x", 0)
                .attr("y", 0)
                .attr("rx", 2)
                .attr("ry", 2)
                .attr("width", lineWidth)
                .attr("height", lineHeight)
                .attr('transform', sTransform);

            var dx2 = x2-x1;
            var dy2 = y2-y1;

            var ndx2 = dx2 * Math.cos(deg) - dy2 * Math.sin(deg);
            var ndy2 = dx2 * Math.sin(deg) + dy2 * Math.cos(deg);

            var nx2 = ndx2 + x1;
            var ny2 = ndy2 + y1;

            var cdx = x1 - nx2;
            var cdy = y1 - ny2;

            var ctheta = Math.atan2(cdy,cdx);
            ctheta *= 180/Math.PI;
            ctheta += 90;

            var cTransform = "translate("+nx2+","+ny2+") rotate("+ctheta+")";
            g_util.append("svg:rect")
                .attr("class", "util")
                .attr("id", i+"S")
                .attr("x", 0)
                .attr("y", 0)
                .attr("rx", 2)
                .attr("ry", 2)
                .attr("width", lineWidth)
                .attr("height", lineHeight)
                .attr('transform', cTransform);

            /*This is for centering the c*/
            var tdeg = deg - .0057;

            dx2 = x2-x1;
            dy2 = y2-y1;

            ndx2 = dx2 * Math.cos(tdeg) - dy2 * Math.sin(tdeg);
            ndy2 = dx2 * Math.sin(tdeg) + dy2 * Math.cos(tdeg);

            nx2 = ndx2 + x1;
            ny2 = ndy2 + y1;

            cdx = x1 - nx2;
            cdy = y1 - ny2;

            var innerCTheta = Math.atan2(cdy,cdx);
            innerCTheta *= 180/Math.PI;
            innerCTheta += 90;

            var innerCTrans = "translate("+nx2+","+ny2+") rotate("+innerCTheta+")";

            tdeg = -.008;
            dx2 = x2-x1;
            dy2 = y2-y1;

            ndx2 = dx2 * Math.cos(tdeg) - dy2 * Math.sin(tdeg);
            ndy2 = dx2 * Math.sin(tdeg) + dy2 * Math.cos(tdeg);

            nx2 = ndx2 + x1;
            ny2 = ndy2 + y1;

            cdx = x1 - nx2;
            cdy = y1 - ny2;

            var innerSTheta = Math.atan2(cdy,cdx);
            innerSTheta *= 180/Math.PI;
            innerSTheta += 90;

            var innerSTrans = "translate("+nx2+","+ny2+") rotate("+innerSTheta+")";

            utilization_info[node_mappings[i]] =
                {cTrans: innerCTrans, sTrans: innerSTrans, cId: node_mappings[i]+"-C",
                 SId:  node_mappings[i]+"-S"};

            count++;
        }
    });
}

function draw_utilization(value,ts) {
    var utils = d3.selectAll(".util_tmp");

    if (util_data[value+ ts["min"]] != null) {
        if (utils[0].length > 0) {
            utils.data([]).exit().remove();
        }

        for (var node in utilization_info) {
            /*Need to identify The node*/

            if (node != "eucboss") {
                var curData = util_data[value+ ts["min"]];

                var portNum = node;
                portNum = portNum.replace("euc", "");
                portNum = parseInt(portNum);

                var g_util = SVG.append("g")
                        .attr("class", "util_tmp");
                var cTransform = utilization_info[node].cTrans;
                var sTransform = utilization_info[node].sTrans;
                var lineWidth = 6;
                var lineHeight = 30;

                var cId = utilization_info[node].cId;
                var sId = utilization_info[node].sId;

                var newHeight = (curData[portNum].in/10) * lineHeight;

                g_util.append("svg:rect")
                    .attr("class", "util_tmp")
                    .attr('filter', 'url(#dropShadow)')
                    .attr("id", cId)
                    .attr("x", 0)
                    .attr("y", 0)
                    .attr("rx", 2)
                    .attr("ry", 2)
                    .attr("width", lineWidth)
                    .attr("height", newHeight)
                    .attr('transform', cTransform)
                    .attr("fill","green");

                newHeight = (curData[portNum].out/100) * lineHeight;

                g_util.append("svg:rect")
                    .attr("class", "util_tmp")
                    .attr('filter', 'url(#dropShadow)')
                    .attr("id", sId)
                    .attr("x", 0)
                    .attr("y", 0)
                    .attr("rx", 2)
                    .attr("ry", 2)
                    .attr("width", lineWidth)
                    .attr("height", newHeight)
                    .attr('transform', sTransform)
                    .attr("fill","red");
            }
        }
    }
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

            var curFlow = flows[flow];

            entry.thread = curFlow.ThreadName;
            entry.stack_trace = curFlow["stack-trace"];
            entry.jid = curFlow.jid;
            entry.src = curFlow["local-host"];
            entry.src_port = curFlow["local-port"];
            entry.dst = curFlow["remote-host"];
            entry.dst_port = curFlow["remote-port"];

            entry.category = curFlow["category"];

            /*Get the endTime*/
            var tstat = flows[flow]["tstat"];
            if (tstat != null && tstat.length <= 2) {
                // RTT buisness for tooltip
                entry.average_rtt = tstat[0][28];
                entry.rtt_min = tstat[0][29];
                entry.rtt_max = tstat[0][30];
                entry.rtt_stddev = tstat[0][31];

                // Now getting the timestamp from tstat
                entry.start = parseInt(tstat[0][97]);

                // Bytes transfered for tooltip
                entry.c2s_bytes = parseInt(tstat[0][8]);
                entry.s2c_bytes = parseInt(tstat[0][52]);

                // Length of the flow for the tooltip
                entry.duration = parseInt(tstat[0][88]);

                // 88th entry is the length of the request
                var flow_len = parseInt(tstat[0][88]);
                entry.end = entry.start + flow_len;

                //8th entry for the size of the flow
                var bytesTransfered = parseInt(tstat[0][8]);
                var weight = Math.log(bytesTransfered/flow_len);
                var line_weight = (((15 - 3)*(weight - play_weight.min))/
                                   (play_weight.max -  play_weight.min)) + 3;

                entry.weight = line_weight;
                map.push(entry);
            }

        }
    }
    return map;
}

function catagorize_flow(src_port, dst_port) {
    if (dst_port == flow_types["Shuffle"].port ||
        src_port == flow_types["Shuffle"].port) {
	// Shuffle
        return "Shuffle";
    } else if (dst_port == flow_types["DataNode"].port ||
               src_port == flow_types["DataNode"].port) {
	// DataNode
        return "DataNode";
    } else if (dst_port == flow_types["NameNode"].port ||
               src_port == flow_types["NameNode"].port) {
	// NameNode
        return "NameNode";
    } else {
        return null;
    }
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

function run_small_store() {
    var flows = large_json();

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

            /* Checking to make sure there is the tstat field/ getting
             * max */

            var tstat = input[flow]["tstat"];
            if (tstat != null && tstat.length <= 2) {
                var timestamp = null;

                /* Checking to make sure it has a tags field and getting
                 * the timestamp out*/

                timestamp = parseInt(tstat[0][97]);

                if (timestamp < ret["min"]) {
                    ret["min"] = timestamp;
                }



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

            //New Way
            var src = input[flow]["local-host"][0];
            var dst = input[flow]["remote-host"][0];

            // Got to keep track of the size
            if (servers[src] != 1) {
                servers.size += 1;
                servers[src] = 1;
            }

            if (servers[dst] != 1) {
                servers.size += 1;
                servers[dst] = 1;
            }

            /*
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
             */
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
        .attr("opacity", function(datum){
            // Make Sure that the opacity is set to what the filters are
            var isOn = cur_filters[datum.port];
            if (isOn) {
                return .1;
            } else {
                return .6;
            }
        })
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

function initSwim() {

    var swim_height = 200;
    var swim_box = SVG.append("svg:rect")
            .attr("class", "swim_box")
            .attr("x", function(){return 0;})
            .attr("y", function(){return svgSize.y - swim_height;})
            .attr("height", function(){ return swim_height;})
            .attr("width", function(){return svgSize.cx;})
            .attr("opacity", function(){return .25;})
            .attr("fill", "gray");

/*
    var swim_text = SVG.append("svg:text")
            .attr("class", "swim_title")
            .attr("x", function(){return svgSize.cx;})
            .attr("y", function(){return svgSize.y - swim_height - 3;})
            .text("Swim Diagram")
            .attr("fill", "black");
*/

    var midline = SVG.append("svg:rect")
            .attr("class", "cur_swim_line")
            .attr("x", function(){return svgSize.cx/2-5;})
            .attr("y", function(){return svgSize.y - swim_height;})
            .attr("height", function(){ return swim_height;})
            .attr("width", function(){return 10;})
            .attr("fill","blue")
            .attr("opacity", .25);



}

function cleanSwimData() {
    var swim_data = swim_json();
    for (var i=0; i < swim_data.length; i++) {
        var str = swim_data[i][1];
        var time = str.split("_")[1];
        var type = str.split("_")[0];
        if (swim_map[swim_data[i][2]] == null)
            swim_map[swim_data[i][2]] = {};
        if( time == "START") {
            swim_map[swim_data[i][2]].t_start = parseInt(swim_data[i][0]*1000);
        } else {
            swim_map[swim_data[i][2]].t_end = parseInt(swim_data[i][0]*1000);
        }
        swim_map[swim_data[i][2]].jid = swim_data[i][3];
        swim_map[swim_data[i][2]].type = type;
    }
}

function getCurSwimmers(curTime, time_width, ts, bucket_num) {
    var swimmers = Array(bucket_num);
    var swim_num = 0;
    for (var swimmer in swim_map) {
        var cur_swimmer = swim_map[swimmer];
        var t_start = cur_swimmer.t_start;
        var t_end = cur_swimmer.t_end;

        if(curTime < t_end && curTime >= t_start) {
            swimmers[swim_num] = cur_swimmer;
            swim_num +=1;

        }

        if (swim_num >= bucket_num) {
            return swimmers;
        }
    }
    return swimmers;
}

function drawSwimData(value, ts) {
    var curTime = value + ts["min"];

    var container = d3.selectAll(".swim_box")[0][0];
    var box_x = parseInt(container.getAttribute("x"));
    var box_y = parseInt(container.getAttribute("y")) + 5;

    var box_height = parseInt(container.getAttribute("height"));
    var box_width = parseInt(container.getAttribute("width"));

    var time_diff = ts["max"] - ts["min"];
    var percent = .08;
    var time_width = box_width/(time_diff*percent);

    var bucket_num = 27;
    var height_per = box_height/bucket_num;
    var swimmers = getCurSwimmers(curTime, time_width, ts, bucket_num);

    var lines = d3.selectAll("line");
    if (lines.length > 0) {
        lines.data([]).exit().remove();
    }

    for (var i = 0; i < swimmers.length; i++) {
        if (swimmers[i] == null) {
            break;
        } else {

            var init_height = box_y + (i*height_per);
            var pos_check = ((swimmers[i].t_start - (curTime-((time_diff * percent)/2)))* time_width);
            var start_x = box_x;
            if (pos_check > 0) {
                start_x = box_x + pos_check;
            }

            pos_check = ((curTime + ((time_diff*percent)/2)) -swimmers[i].t_end) * time_width;
            var end_x = end_x = box_x + box_width;
            if (pos_check > 0) {
                end_x = (box_x + box_width) - pos_check;
            }

            var color = "blue";
            if (swimmers[i].type == "MAPPER") {
                color = "red";
            }

            SVG.append("svg:line")
                .attr("class", "swim_line")
                .attr("x1", start_x)
                .attr("x2", end_x)
                .attr("y1", init_height)
                .attr("y2", init_height)
                .attr("stroke", color)
                .attr("stroke-width", 5);
        }
    }

}

function setup(servers, flows, time_stats) {
    util_data = util_json();
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

    /*This is for the start and endpoints of the link utilization*/
    var linkStartPoints = circleCoords(serverCircleRadius +
                                       serverRadius,numServers, svgSize.cx/2, svgSize.cy/2);

    var linkEndPoints = circleCoords(serverCircleRadius +
                                       serverRadius+ 15,numServers, svgSize.cx/2, svgSize.cy/2);

    servers = createServers(serverLayout, serverRadius, servers,
                            pathEndpoints, linkEndPoints, linkStartPoints);

    // Setup swim graph
    initSwim();
    cleanSwimData();

    // Setup utilization displays
    createUtilization(servers);


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
            if (cur_filters[flow_map[i].dst_port] == null &&
               cur_filters[flow_map[i].src_port] == null) {
                curFlows.push(flow_map[i]);
            }
        }
    }
    return curFlows;
}

/* FIX: Pick up here, Also, use the fucking change map*/
function drawFlows(curFlows, servers) {

    // Remove the previous flows
    var lines = $("path").unbind();//d3.selectAll("path");
    lines = d3.selectAll("path");
    if (lines.length > 0) {
        lines.data([]).exit().remove();
        if($(".tipsy").length > 1) {
            $(".tipsy").remove();
        }

    }

    for (var i = 0; i < curFlows.length; i++) {
        var src = servers[curFlows[i].src].path;
        var dst = servers[curFlows[i].dst].path;

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

        var color = "purple";
        if(tmp_flow_types_hack[curFlows[i].category[0]] != null) {
	    color = tmp_flow_types_hack[curFlows[i].category[0]].color;
        } else {
            debugger;
        }

        SVG.append("svg:path")
            .attr("d", lineFunction(lineData))
            .attr("stroke", color)
            .attr("opacity", .5)
            .attr("stroke-width", curFlows[i].weight)
            .attr("fill", "none");

    }

    var paths = SVG.selectAll("path")
            .data(curFlows)
            .call(hadoopPathTooltip);
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
    draw_utilization(value, play_ts);
    drawSwimData(value, play_ts);
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
                draw_utilization(ui.value ,ts);
                drawFlows(curFlows, servers);
                drawSwimData(ui.value, ts);
            }
        });
    });
}
