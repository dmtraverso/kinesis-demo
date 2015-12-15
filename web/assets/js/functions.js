// Initialize the Amazon Cognito credentials provider
// unauthusers 
AWS.config.region = 'us-east-1';
AWS.config.credentials = new AWS.CognitoIdentityCredentials({
    IdentityPoolId: 'us-east-1:61a27d9b-0a50-4937-ac51-80086b76926c',
});
// Connect to Kinesis
var kinesis = new AWS.Kinesis({apiVersion: '2013-12-02'});

// Constants for configuration
GRAPH_INTERVAL = 3000
TRACKING_INTERVAL = 750
TRACKING_BATCH = 50
API_VERSION = "v1"
API_ENDPOINT = "https://a1uu9q64cg.execute-api.us-east-1.amazonaws.com/"
API_GATEWAY = API_ENDPOINT + API_VERSION

// Global variables 
var event_count = 0                   // total number of tracked events
var events = []                       // array to hold positions
var myLiveChart = new Object()        // Graph
var last_evaluated_key = new Object() // last evaluated key to keep Graph updated
var tracking = false

// Detect if the browser is IE or not.
// If it is not IE, we assume that the browser is NS.
var IE = document.all?true:false;
var trackingIntervalId = 0

$(document).ajaxStart(function () {
    console.log('ajaxstart')
    $("#loading").toggle();
});

$(document).ajaxStop(function () {
    $("#loading").hide();
});

// Main function
$(window).load(function(){
  // Check if browser supports LocalStorage
  if(typeof(Storage) !== "undefined") {
    // Load data for returning users
    if (!localStorage.user_id) {
        // Save uuid into the Browser's LocalStorage
        localStorage.user_id = guid().toString()
    }
    user_id = localStorage.user_id
    // Load user movements
    loadUserData()
    // Stop tracking if window is not in focus
    $(window).blur(function() {
      if (tracking) {
        removeHandler()
      }
    });

    // Resume tracking if window is in focus
    // and tracking was enabled
    $(window).focus(function() {
      if (tracking) {
        addHandler()
      }
    });
  }
  else {
    // Sorry! No Web Storage support..
    alert('ERROR: Web Storage not supported!')
  }
});

// Call heatmap function when modal is shown
$(function() {
    $('#modalHeatmap').on('shown.bs.modal', function() {
        heatmap();
    });
});


function deleteUser() {
    console.log("Deleting user: " + user_id)
    $.ajax({
        url: API_GATEWAY + "/users/" + user_id,
        type: 'DELETE',
        success: console.log('Deleted') || $.noop,
        error: console.log('Error deleting') || $.noop
    });
}

function guid() {
  function s4() {
    return Math.floor((1 + Math.random()) * 0x10000)
      .toString(16)
      .substring(1);
  }
  return s4() + s4() + '-' + s4() + '-' + s4() + '-' +
    s4() + '-' + s4() + s4() + s4();
}

// disable / enable button
function updateButton(id) {
  if (document.getElementById(id).disabled) {
    document.getElementById(id).disabled = false;
  }
  else {
    document.getElementById(id).disabled = true;
  }
};

// add tracking function to document
function addHandler() {
  if (document.addEventListener) {
      document.addEventListener("mousemove", getMouseXY);
  } else if (document.attachEvent) {
      document.attachEvent("onmousemove", getMouseXY);
  }
  $("#banner").toggle();
  updateButton("buttonStop"); 
  updateButton("buttonStart");
  // Flush events every interval
  trackingIntervalId = setInterval(updateCounters, TRACKING_INTERVAL)
  // Update Graph every interval
  graphIntervalId = setInterval(updateGraph, GRAPH_INTERVAL);
};

// user requested stop tracking
function stopTracking() {
  tracking = false
  removeHandler()
}

function startTracking() {
  tracking = true
  addHandler()
}

// remove tracking function from document
function removeHandler() {
  clearInterval(trackingIntervalId);
  clearInterval(graphIntervalId);
  if (document.removeEventListener) {
      document.removeEventListener("mousemove", getMouseXY);
  } else if (document.detachEvent) {
      document.detachEvent("onmousemove", getMouseXY);
  }
  $("#banner").hide();
  updateButton("buttonStop");
  updateButton("buttonStart");
};

function updateGraph() {
  var curr_time = now()
  console.log('Updating graph with: ', last_evaluated_key)
  // Call API Gateway to refresh grahp
  //$.get("https://dy32bitlkc.execute-api.us-east-1.amazonaws.com/test/user/" + username + "/refresh?start_time=" + last_evaluated_key)
  //$.get(API_GATEWAY + "/users/" + user_id + "/movements/" + last_evaluated_key)
  $.ajax({
    url: API_GATEWAY + "/users/" + user_id + "/movements/" + last_evaluated_key
  })
    // Success
    .done(function (data) {
      console.log('API Gateway response: ', JSON.stringify(data))
      if (data.length == 0) {
        // No data, populate with 0
        data[0] = {
          count: 0,
          timestamp: curr_time
        }
      }
      else {
        // ony save last evaluated key for future queries
        // if query returned data
        last_evaluated_key = data[data.length - 1].timestamp
      }
      // Count number of events
      total_events = 0
      for (i = 0; i < data.length; i++) {
        total_events = total_events + Number(data[i].count)
      }
      // update graph 
      myLiveChart.addData([total_events], new Date(curr_time * 1000).toLocaleTimeString());
      // Remove the first point so we dont just add values forever
      if (myLiveChart.datasets[0].points.length > 10) {
        myLiveChart.removeData();
      }
    })
    // Error
    .fail(function() {
      console.log('Could not refresh graph');
    });
}

// returns time in seconds in string
function now() {
  var d = new Date()
  return Math.round(d.getTime() / 1000).toString()
};

function nowMilis() {
  var d = new Date()
  var n = d.getTime()
  return n;
};

// Function to call Kinesis
function sendDataToKinesis(positions) {
  // create Array for params in PutRecords 
  var records = []
  for (var i = 0; i < positions.length; i++) {
    records[i] =
      {
        Data: JSON.stringify(positions[i]),
        PartitionKey: 'key'
      }
  }
  // create params for PutRecords request 
  var params = {
    Records: records,
    StreamName: 'test-date'
  };
  // Call Kinesis
  kinesis.putRecords(params, function(err, data) {
    if (err) {
      // an error occurred
      console.log(err, err.stack);
    }
    else {
      // successful response
      //log('Successfuly sent ' + data.Records.length + ' events to Kinesis')
      console.log("Response from Kinesis: ", data);
      //callback(data)
    }
  });
}

function updateCounters(movement) {
  // if movement is defined, it was called by getMouse
  if (movement) {
    events[event_count] = movement
    // increment number of tracking events
    event_count += 1;
    if (event_count < TRACKING_BATCH) {
      // do not send events to Kinesis yet
      return
    }
  }
  else {
    // there are no movements, populate with 0
    if (event_count == 0) {
      events[event_count] = {
        Username: user_id,
        X: 0,
        Y: 0,
        Time: nowMilis()
      }
    }
  }
  console.log('Sending events: ' + event_count)
  //log('Sending ' + event_count + ' events')
  // copy array and call Kinesis function. IMPROVE
  var temp = events.slice()
  // reset counter, empty positions array
  events.length = 0
  event_count = 0;
  // Call Kinesis async
  sendDataToKinesis(temp)
  // Reset interval
  clearInterval(trackingIntervalId)
  // Call setInterval again only if tracking wasn't disabled
  if (tracking) {
    trackingIntervalId = setInterval(updateCounters, TRACKING_INTERVAL)
  }
  return
}

// Main function to retrieve mouse x-y pos.s
function getMouseXY(e) {
  // Temporary variables to hold mouse x-y pos.s
  var tempX = 0
  var tempY = 0
  if (IE) { // grab the x-y pos.s if browser is IE
    tempX = event.clientX + document.body.scrollLeft
    tempY = event.clientY + document.body.scrollTop
  } else {  // grab the x-y pos.s if browser is NS
    tempX = e.pageX
    tempY = e.pageY
  }  
  // catch possible negative values in NS4
  if (tempX < 0){tempX = 0}
  if (tempY < 0){tempY = 0}
  // show coordinates in HTML
  $('#positionX').html(tempX)
  $('#positionY').text(tempY)
  // add coordinates to array
  var movement =
    {
      Username: user_id,
      X: tempX,
      Y: tempY,
      Time: nowMilis()
    }  
  // call function to update counters and flush data if necessary
  updateCounters(movement)
}

// NOTES:  
//        add function to return data ready for Chartjs
//        Improve graph scale (?)

function drawChart(data) {
  datapoints = []
  counters = []
  if (data.length == 0) {
    // as we do not have any data, populate with
    // current time and 0 events
    datapoints = [new Date().toLocaleTimeString()]
    counters = [0]
  }
  else {
    // populate chart_data object with response from DynamoDB
    for (i = 0; i < data.length; i++) {
      datapoints[i] = new Date(data[i].timestamp * 1000).toLocaleTimeString();
      // only one dataset (just one user)
      counters[i] = data[i].count;
    };
  }
  console.log("Drawing chart with: " + datapoints) 
  // NOTE: improve code
  var canvas = document.getElementById('updating-chart');
  var ctx = canvas.getContext('2d');
  var chart_data = {
    labels: datapoints,
    datasets: [
        {
            fillColor: "rgba(151,187,205,0.2)",
            strokeColor: "rgba(151,187,205,1)",
            pointColor: "rgba(151,187,205,1)",
            pointStrokeColor: "#fff",
            //fillColor: "#3498DB",
            //strokeColor: "#3498DB",
            data: counters
        }
    ]
  };

  // Reduce the animation steps for demo clarity.
  myLiveChart = new Chart(ctx).Line(chart_data, {animationSteps: 10});
}

function loadUserData() {
  $("#charts").toggle()
  // Save current time for future queries
  curr_time = now()
  // Call API to get graph data
  //$.get("https://dy32bitlkc.execute-api.us-east-1.amazonaws.com/test/user/" + username + "/load")
  //$.get(API_GATEWAY + "/users/" + user_id + "/movements/" + curr_time + "?reverse=true")
    $.ajax({
    url: API_GATEWAY + "/users/" + user_id + "/movements/" + curr_time + "?reverse=true"
  })
    // Success
    .done(function (data) {
      console.log('API Gateway: ', JSON.stringify(data))
      // save last evaluated key for future queries
      if (data.length == 0) {
        last_evaluated_key = curr_time
      }
      else {
        last_evaluated_key = data[0].timestamp
      }
      // create first chart
      drawChart(data.reverse())                       
    })
    // Error
    .fail(function() {
      console.log('Could not load graph');
    });
};

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
                    if (last_position_id) {
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