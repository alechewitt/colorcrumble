attribute vec2 a_coords;
uniform float u_width;
uniform float u_height;
uniform mat3 u_transform;
attribute vec2 a_texCoords;
varying vec2 v_texCoords;
void main() {
   v_texCoords = a_texCoords;

   vec3 transformedCoords = u_transform * vec3(a_coords, 1.0);
   float x = -1.0 + 2.0 * (transformedCoords.x / u_width);
   float y = 1.0 - 2.0 * (transformedCoords.y / u_height);
   gl_Position = vec4(x, y, 0.0, 1.0);
}
