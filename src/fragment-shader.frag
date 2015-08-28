precision mediump float;
uniform vec3 u_color;
uniform sampler2D u_texture;
varying vec2 v_texCoords;
void main() {
    vec4 textureColor = texture2D( u_texture, v_texCoords );
    gl_FragColor = vec4(u_color, 1.0 - textureColor.a);

}