jQuery.fn.outerHTML = function() {
    return jQuery('<div />').append(this.eq(0).clone()).html();
};

var PathTooltip = function() {
    var tooltip = Tooltip().title(function(d) {
        var data = d;

        var reserved = ["jid", "thread", "stack_trace", "src",
                        "src_port", "dst", "dst_port", "catagory",
                        "average_rtt", "rtt_min", "rtt_max",
                        "rtt_stddev", "c2s_bytes",
                        "s2c_bytes", "duration"];

        function appendRow(key, value, tooltip) {
            var keyrow = $("<div>").attr("class", "key").append(key);
            var valrow = $("<div>").attr("class","value").append(value);
            var clearrow = $("<div>").attr("class", "clear");
            tooltip.append($("<div>").append(keyrow).append(valrow).append(clearrow));
        }

        var tooltip = $("<div>").attr("class", "path-tooltip");
        var seen = {"Operation": true, "Edge": true, "version": true};

        // Do the reserved first
        for (var i = 0; i < reserved.length; i++) {
            var key = reserved[i];
            if (data.hasOwnProperty(key)) {
                if (key == "stack_trace") {
                    var did_update = false;
                    var str = data[key];
                    var count = 0;
                    for (var j = 0; j < str.length; j++) {
                        if (str[j] == ')' && count != 5) {
                            console.log(count);
                            count++;
                        } else if (str[j] == ')' && count == 5){
                            debugger;
                            did_update = true;
                            appendRow(key, str.substring(0,j+1).concat("..."), tooltip);
                            break;
                        }
                    }
                    // Stack Traces can be obcenely long
                    if(!did_update) {
                        appendRow(key,str,tooltip);
                    }
                } else {
                    appendRow(key, data[key], tooltip);
                }
                seen[key] = true;
            }
        }

        // Do the label
        appendRow("Label", data, tooltip);

        return tooltip.outerHTML();
    });
    return tooltip;
}


var Tooltip = function() {
    var tooltip = function(selection) {
        selection.each(function(d) {
            $(this).tipsy({
                gravity: $.fn.tipsy.autoWE,
                html: true,
                title: function() {return title(d); },
                opacity: 1
            });
        });
    };

    var title = function(d) { return ""; };

    tooltip.hide = function() { $(".tipsy").remove(); };
    tooltip.title = function(_) {
        if (arguments.length==0) {
            return title;
        } else {
            title = _;
            return tooltip;
        }
    };

    return tooltip;
};
