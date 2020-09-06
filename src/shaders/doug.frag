uniform float timeDelta;
uniform float dougX;


void main() {
  // vec4 foo = (gl_FragCoord.x<250.0) ? vec4(1.0, 0.0, 0.0, 1.0) : vec4(0.0, 1.0, 0.0, 1.0);

  float distFromCenter = 60.0;
  float normalizedDougX = abs(dougX) / distFromCenter;


  gl_FragColor = vec4(1.0 - normalizedDougX, 1.0 - normalizedDougX, 1.0 - normalizedDougX, 0.5);

}