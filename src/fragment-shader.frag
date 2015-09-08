precision mediump float;
uniform vec3 u_color;
uniform sampler2D u_texture;
varying vec2 v_texCoords;
void main() {
    vec4 textureColor = texture2D( u_texture, v_texCoords );
    vec3 colorMixed = (textureColor.rgb * textureColor.a) + (u_color * (1.0 - textureColor.a));
    //    gl_FragColor = vec4(colorMixed, 1.0);

    gl_FragColor = vec4(u_color, 1.0 - textureColor.a);
}