// All the paths
var paths = [];
// Are we painting?
var painting = false;
// How long until the next circle
var next = 0;
// Where are we now and where were we?
var current;
var previous;

var marlyn = getDrawing();

function setup() {
  createCanvas(1024, 768);
  current = createVector(0,0);
  previous = createVector(0,0);
  
  // Instantiate a Sine Wave Oscillator
  osc = new p5.SinOsc();

  // Tell the Oscillator to start oscillating.
  // We hear the frequency of these oscillators as a pitch.
  osc.start();

  osc.freq(0);
  // Oscillator has an output amplitude of 0.5 by default.
  // We can make it louder.
  osc.amp(1);
  
};

var pointIndex = 0;

function draw() {
  /*background(200);*/
  
  // If it's time for a new point
  if (millis() > next && painting) {

    for(var i=0;i<10;i++)
    {
      if(marlyn[pointIndex] != 0)
      {
        
        // Grab mouse position      
        current.x = mouseX + Math.cos((marlyn[pointIndex]-1)*Math.PI/60)*300;
        current.y = mouseY + Math.sin((marlyn[pointIndex]-1)*Math.PI/60)*300;
        pointIndex = (pointIndex + 1) % marlyn.length;
        // New particle's force is based on mouse movement
        var force = 1;/*p5.Vector.sub(current, previous);
        force.mult(0.05);*/
    
        // Add new particle
        paths[paths.length - 1].add(current, force);
        
        if(pointIndex>2)
        {
          
          lastx = mouseX + Math.cos((marlyn[pointIndex-2]-1)*Math.PI/60)*400;
          lasty = mouseY + Math.sin((marlyn[pointIndex-2]-1)*Math.PI/60)*400;
        
          // map the mouseX to set frequency of the between 40 and 880 Hz
          lineLength = Math.sqrt( (lastx-current.x)*(lastx-current.x) + (lasty-current.y)*(lasty-current.y) );
          var freq = map(lineLength, 0, 800, 40, 880);
          osc.freq(freq);
        }
      }
      else
      {
        pointIndex = 0;
        painting = 0;
      }
    }
    
    // Schedule next circle
    next = millis() +  0/*random(100)*/;

    // Store mouse values
    previous.x = current.x;
    previous.y = current.y;
  }

  // Draw all paths
  for( var i = 0; i < paths.length; i++) {
    paths[i].update();
    paths[i].display();
  }
}

// Start it up
function mousePressed() {
  next = 0;
  painting = true;
  previous.x = mouseX;
  previous.y = mouseY;
  paths = [];
  paths.push(new Path());
  var helpText = document.getElementById('HelpText');
    helpText.style.display = "None";
  var about = document.getElementById('About');
    about.style.display = "None";
}

// Stop
function mouseReleased() {
  painting = false;
  osc.freq(0);
}

// A Path is a list of particles
function Path() {
  this.particles = [];
  this.hue = random(100);
}

Path.prototype.reset = function() {
    this.particles = [];
}
Path.prototype.add = function(position, force) {
  // Add a new particle with a position, force, and hue
  this.particles.push(new Particle(position, force, this.hue));
}

// Display plath
Path.prototype.update = function() {  
  for (var i = 0; i < this.particles.length; i++) {
    this.particles[i].update();
  }
}  

// Display plath
Path.prototype.display = function() {
  
  // Loop through backwards
  for (var i = this.particles.length - 1; i >= 0; i--) {
    // If we shold remove it
    if (this.particles[i].lifespan <= 0) {
      this.particles.splice(i, 1);
    // Otherwise, display it
    } else {
      this.particles[i].display(this.particles[i+1]);
    }
  }

}  

// Particles along the path
function Particle(position, force, hue) {
  this.position = createVector(position.x, position.y);
  this.velocity = createVector(force.x, force.y);
  this.drag = 0.95;
  this.lifespan = 10/*255*/;
}

Particle.prototype.update = function() {
  // Move it
  this.position.add(this.velocity);
  // Slow it down
  this.velocity.mult(this.drag);
  // Fade it out
  this.lifespan--;
}

// Draw particle and connect it with a line
// Draw a line to another
Particle.prototype.display = function(other) {
  stroke(0, this.lifespan);
  fill(color(random(255),random(255),random(255)), this.lifespan/2);    
  ellipse(this.position.x,this.position.y, 8, 8);
  // If we need to draw a line
  if (other) {
    line(this.position.x, this.position.y, other.position.x, other.position.y);
  }
}


function getDrawing()
{
  return [
    1,96,2,32,64,31,63,33,75,48,14,51,15,50,14,47,10,46,15,47,74,51,79,36,78,35,66,36,80,52,81,38,6,40,84,41,69,43,7,37,81,56,20,55,21,53,79,57,20,51,
21,57,84,55,19,56,83,38,5,101,3,97,120,98,3,32,75,50,21,54,20,73,52,14,49,21,47,72,45,8,41,5,40,83,53,78,57,81,39,7,106,86,63,28,61,31,59,79,56,82,
38,7,36,63,41,68,88,108,87,65,86,61,29,54,31,3,96,120,99,3,102,2,95,3,33,76,34,3,100,120,93,116,92,113,90,111,91,114,52,83,55,18,72,15,70,42,5,32,57,77,
36,81,61,24,56,21,45,74,32,4,36,82,40,69,45,7,42,84,61,41,71,17,41,66,45,11,40,7,107,87,42,14,70,5,100,2,98,118,96,116,91,113,52,79,37,16,70,17,49,76,
35,3,41,75,54,86,66,28,58,20,74,21,52,29,63,83,41,6,32,114,90,115,65,88,67,43,6,71,15,49,111,89,47,9,109,45,14,53,81,51,83,39,84,38,80,56,29,62,27,104,
5,34,7,105,27,60,25,62,119,93,113,51,31,71,18,54,3,94,120,63,43,84,54,79,48,21,41,81,59,21,77,17,39,3,36,5,43,87,41,73,49,13,50,111,47,69,4,98,119,96,
4,38,8,36,69,89,109,87,56,6,35,80,30,107,9,40,3,68,42,76,47,67,11,68,15,48,112,13,46,88,111,51,2,94,118,22,77,34,75,43,21,75,15,69,5,37,83,59,95,120,
92,119,97,22,96,61,26,103,3,38,63,114,89,67,39,16,36,6,44,85,41,70,45,75,20,53,115,34,8,46,89,63,26,104,28,59,14,40,87,63,97,118,87,55,109,49,69,21,119,24,
101,42,4,70,6,42,86,116,94,114,64,1,52,120,91,71,5,56,84,53,73,31,85,59,93,57,29,79,24,102,5,97,2,52,19,57,82,37,80,45,106,9,33,4,55,31,81,60,96,6,
31,75,111,48,120,87,33,6,39,61,118,93,56,77,18,73,46,21,42,8,35,77,49,110,90,49,20,70,37,118,91,36,118,66,116,64,26,102,25,80,29,84,104,24,100,41,74,49,71,14,
43,83,58,29,107,44,88,109,48,12,57,110,46,77,37,6,55,82,62,118,86,39,5,55,29,85,65,1,93,114,53,2,40,16,76,53,16,84,44,108,9,105,85,113,13,51,120,22,80,59,
86,52,77,45,67,119,23,96,64,120,90,20,47,17,51,3,93,115,92,19,73,109,56,86,32,7,72,19,50,70,103,24,99,39,82,42,11,59,82,52,91,119,99,65,42,3,37,78,34,88,
55,116,35,83,36,10,48,19,78,38,68,120,49,96,21,71,43,102,41,72,6,66,29,109,47,71,19,89,116,84,17,37,8,32,107,54,2,33,80,40,4,51,112,92,56,110,89,120,66,9,
44,105,5,103,27,83,47,88,112,76,15,52,74,31,111,76,56,10,58,8,40,99,5,96,62,31,53,25,46,93,55,108,30,3,69,16,42,103,52,3,50,113,32,65,45,79,113,53,1,98,
23,60,97,117,36,113,75,8,83,61,97,47,13,48,77,51,1,101,41,88,119,87,67,2,49,12,88,62,16,73,93,20,46,14,54,115,86,107,71,24,78,21,61,95,115,63,6,45,17,42,
85,56,95,20,40,17,54,116,85,64,115,35,57,111,58,94,46,107,40,100,66,5,52,32,109,83,29,77,11,73,15,43,109,72,16,68,4,37,84,64,88,59,99,2,69,29,3,72,106,29,
60,39,18,78,28,64,106,39,4,53,116,90,70,31,112,89,56,120,21,102,73,29,71,7,41,4,66,117,61,32,93,48,68,10,55,91,45,103,18,86,120,72,105,53,19,96,37,92,20,72,
93,13,37,64,86,41,77,113,88,28,84,18,92,36,65,39,12,50,1,48,70,101,2,75,6,81,108,31,68,1,87,19,59,29,101,62,42,22,79,38,116,95,5,98,51,90,112,14,55,118,
51,101,40,105,69,14,62,110,51,119,20,60,117,96,35,7,44,104,43,78,23,79,28,109,11,111,65,118,92,68,46,9,81,102,28,68,117,23,59,37,9,59,84,52,100,80,49,101,23,95,
118,23,44,21,76,31,80,53,7,67,32,55,77,112,47,82,16,89,34,111,62,24,75,27,61,119,90,43,107,45,85,19,100,63,1,54,82,24,77,115,94,34,2,66,88,45,9,84,114,0,

    ];
}
