var flow_map = [];
var SVG = null;
var play_timer = 0;
var svgSize = {x : 600, y : 600};
var play_ts = {"min": 0};
var play_servers = null;
var play_weight = {"min": 9007199254740992, "max": -1};

function circleCoords(radius, steps, centerX, centerY) {
    var xValues = [centerX];
    var yValues = [centerY];
    for (var i = 1; i < steps; i++) {
        xValues[i] = (centerX + radius * Math.cos(2 * Math.PI * i /
                                                  steps-Math.PI/2));
        yValues[i] = (centerY + radius * Math.sin(2 * Math.PI * i /
                                                  steps-Math.PI/2));
   }
    yValues[0] = yValues[0] - radius;
    return {x : xValues, y : yValues};
}


function newCircleCoords(radius, steps, centerX, centerY) {
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

function updateServers(coords, rad, servers) {
    var xValues = coords.x;
    var yValues = coords.y;
    var dataset = [];

    // Create the Dataset
    for (var server in servers) {
        if (servers.hasOwnProperty(server) && server != "size") {
            dataset.push(server);
        }
    }


    // Create the Fucking circles
    // http://stackoverflow.com/questions/13615381/d3-add-text-to-circle
    for (i = 0; i < xValues.length; i++) {
        SVG.append("circle")
            .style("stroke", "gray")
            .style("fill", "white")
            .attr("r", rad)
            .attr("cx", xValues[i])
            .attr("cy", yValues[i])
            .on("mouseover", function(){d3.select(this).style("fill","aliceblue");})
            .on("mouseout", function(){d3.select(this).style("fill", "white");});
    }

    var circles = SVG.selectAll("circle")
            .data(dataset);

    // TODO: This still isn't that efficient
    // Return a map of addresses to circles
    for (var i = 0; i < circles.length; i++) {
        servers[dataset[i]] = circles[i];
    }
    return servers;
}

function createServers(coords, rad, servers) {
    var numCircles = 10;

    var g_circles = SVG.append("g")
            .attr("class","circles");

    var dataset = [];

    // Create the Dataset
    for (var server in servers) {
        if (servers.hasOwnProperty(server) && server != "size") {
            dataset.push(server);
        }
    }

    $.each(coords, function(i, d) {
        g_circles.append("circle")
            .attr('filter', 'url(#dropShadow)')
            .attr("class","circle")
            .attr("id", "circle" + i)
            .attr("r", 30)
            .attr("cx", d[0])
            .attr("cy", d[1])
            .text("Heel")
            .data(dataset[i]);

        /* TODO: I really should put these in a div so that I can
         * center these bitches
         */

        SVG.append('text')
            .text(dataset[i])
            .attr("class", "labels")
            .attr("x", d[0] - 25)
            .attr("y", d[1] + 3)
            .attr('fill', 'black');
    });

    var circles = SVG.selectAll("circle")
            .data(dataset);

    for (var i = 0; i < circles[0].length; i++) {
        servers[dataset[i]] = circles[0][i];
    }

    return servers;
}

/* buidFlowMap flows -> [flow1, flow2, ..., flowN]
 * This function is where the heavy lifting happens. We scroll through
 *  all the flows and build a relevent map of changes in flows over
 *  time.
*/
/*TODO: time_stats is currently unused. Do I need it?*/
function buildFlowMap(flows, time_stats) {

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
                    var weight = bytesTransfered/flow_len;
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
    var servers = getServers(flows);
    var time_stats = generateTimeStats(flows);

    //FIX: This could be the worst thing I have ever done
    play_ts = time_stats;
    play_servers = servers;

    flow_map = buildFlowMap(flows, time_stats);
    //console.log(flow_map);


    //console.log(flows);
    //console.log(time_stats);

    /* TODO: I shouldn't need the flows in the setup, right?*/
    setup(servers, flows, time_stats, flow_map);
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
                var weight = bytesTransfered/flow_len;

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
 *  a size field to the object to get how many servers are used. It is
 * currently not that efficient, but we will leave that as a TODO
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

function setup(servers, flows, time_stats, flow_map) {

    // Initialize the canvas
    SVG = d3.select("#viz").append("svg")
            .attr("width", svgSize.x)
            .attr("height", svgSize.y);

    // Info About Servers
    var numServers = servers.size;
    var serverCircleRadius = 250;
    var serverRadius = 35;


    /*Add the text with the time*/
    SVG.append("text")
        .attr("x", function(d){return svgSize.x - 150;})
        .attr("y", function(d){return svgSize.y - 25;})
        .text("Time:");
    SVG.append("text")
        .attr("class","time_val")
        .attr("x", function(d){return svgSize.x - 140;})
        .attr("y", function(d){return svgSize.y - 10;})
        .text("0");


    // Calculate the locations of the servers
    var serverLayout = circleCoords(serverCircleRadius, numServers,
                                    svgSize.x/2, svgSize.y/2);


    // Initialize definitions
    createDefs(SVG.append('svg:defs'));


    // Add classes
    var newSL = newCircleCoords(serverCircleRadius, numServers,
                                    svgSize.x/2, svgSize.y/2);

    servers = createServers(newSL, serverRadius, servers);

    //var curFlows = currentFlows(0, time_stats);
    //drawFlows(curFlows, servers);

    // Create the SVG objects
    //updateServers(serverLayout, serverRadius, servers);
    setupSlider(SVG, time_stats, servers);
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
        if ((value + ts["min"]) < flow_map[i].end && (value + ts["min"]) >= flow_map[i].start) {
            curFlows.push(flow_map[i]);
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

        var lineData = [{'x': parseInt(src.attributes.cx.nodeValue), //Src
                         'y': parseInt(src.attributes.cy.nodeValue)},
                        {'x': svgSize.x/2, // Center
                         'y': svgSize.y/2},
                        {'x': parseInt(dst.attributes.cx.nodeValue), // Dst
                         'y': parseInt(dst.attributes.cy.nodeValue)}];

        var lineFunction = d3.svg.line()
                .x(function(d) { return d.x; })
                .y(function(d) { return d.y; })
                .interpolate("basis");

        //debugger;
        SVG.append("path")
            .attr("d", lineFunction(lineData))
            .attr("stroke", "blue")
            .attr("stroke-width", curFlows[i].weight)
            .attr("fill", "none");
    }

}

function setup_play() {
    var max = $("#slider").slider("option", "max");
    if (play_timer == 0) {
        console.log(play_timer);
        play_timer = setInterval(function(){ play(max);}, 10);
    } else {
        console.log("Cant setup, it already exists");
    }
}

function abort_play() {
    console.log("Hitting abort");
    clearInterval(play_timer);
    play_timer = 0;
}

function play(end_time) {
    var value = $("#slider").slider("option", "value");


    if (value < end_time) {
        $("#slider").slider("value", (value+1));
        d3.selectAll("text.time_val").text(value+1);
    } else {
        console.log("Clearing interval");
        clearInterval(play_timer);
        play_timer=0;
    }
    var curFlows = currentFlows(value, play_ts);
    drawFlows(curFlows, play_servers);
}

function setupSlider(SVG, ts, servers) {
    $(function() {
        $("#button_bar")[0].style.display = "block";
        $( "#slider" ).slider({
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
