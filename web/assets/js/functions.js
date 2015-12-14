function heatmap() {
  // Get the window dimensions
  var wWidth  = $(window).width();
  var wHeight = $(window).height();
  $(".heatmap").width(wWidth)
  $(".heatmap").height(wHeight)
  // remove previous canvas if exists
  if ($(".heatmap-canvas").length) {
    $(".heatmap-canvas").remove();
  }
  // minimal heatmap instance configuration
  var heatmapInstance = h337.create({
    // only container is required, the rest will be defaults
    container: document.querySelector('.heatmap')
  });

  var curr_time = now()
  console.log('Loading heatmap with timestamp: ' + curr_time)
  $.get(API_GATEWAY + "/users/" + user_id + "/movements/" + curr_time + "?reverse=true&count=false&limit=15")
    // Success
    .done(function (data) {
      console.log('Heatmap: ', JSON.stringify(data))
        //console.log(data)
        var counters = {}
        var max = 0
        var id = ""
        var last_position_id = ""
        // Let's agregate the data, count ocurrences for each position
        for (i = 0; i < data.length; i++) {
            for (j = 0; j < data[i].movs.length; j++) {
                // if position is X:0 and Y:0 means the mouse
                // haven't moved since last recorded position
                if (data[i].movs[j].X === 0 && data[i].movs[j].Y === 0) {
                    // If there is a previous position, we'll increment
                    // counter for the last recorded position
                    console.log('outside if')
                    if (last_position_id) {
                        console.log('inside if')
                        id = last_position_id
                    }
                }
                else {
                    // Track regular movment using string "x:y"
                    // as index of associative array
                    var id = (data[i].movs[j].X + ':' + data[i].movs[j].Y).toString()
                    // this is now the last recorded position
                    last_position_id = id
                }
                // if id is not defined, position was X:0 and Y:0
                // but we do not have a previous position to increment
                if (id) {
                    if (!(id in counters)) { // initialize counter for this position
                        counters[id] = 1
                    }
                    else {                  // increment counter for this position
                        counters[id]++
                    }
                    max = Math.max(max, counters[id]);
                }
            }
        }
        
        var points = [];
        // Prepare data for Heatmap 
        for (var key in counters) {
            // get X and Y from the object ids 'x:y'
            var cords = key.split(':')
            var point = {
                    x: cords[0],
                    y: cords[1],
                    value: counters[key]
                }
            points.push(point)
        }
        // heatmap data format
        var data = { 
          max: max, 
          data: points 
        };
        console.log(data)
        // if you have a set of datapoints always use setData instead of addData
        // for data initialization
        heatmapInstance.setData(data);
        $(".heatmap").width(wWidth*0.6)
        $(".heatmap").height(wHeight*0.6)
        $(".heatmap-canvas").width(wWidth*0.6)
        $(".heatmap-canvas").height(wHeight*0.6)
        $("#modTest").height(wHeight*0.6)
        $("#modTest").width(wWidth*0.6)
        $("#modalHeatmap").modal()
    })
    // Error
    .fail(function() {
      console.log('Could not refresh graph');
    });
}

function deleteUser() {
    console.log("Deleting user: " + user_id)
    $.ajax({
        url: API_GATEWAY + "/users/" + user_id,
        type: 'DELETE',
        success: console.log('Deleted') || $.noop,
        error: console.log('Error deleting') || $.noop
    });
}