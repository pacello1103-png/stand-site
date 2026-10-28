export const LOOKS={natural:{label:"Natural"},bright:{label:"Bright",light:.22,contrast:.04,shadows:.3,colour:.08,clarity:.08},warm:{label:"Warm",warmth:.4,colour:.1,contrast:.06,light:.04},studio:{label:"Studio",contrast:.12,colour:.08,sharp:.35,vignette:.25,highlights:.3,clarity:.2},soft:{label:"Soft",contrast:-.1,shadows:.2,highlights:.35,sharp:-.15,warmth:.1,clarity:-.15},film:{label:"Film",contrast:.06,fade:.08,colour:-.15,warmth:.15,vignette:.22},cool:{label:"Cool",warmth:-.32,contrast:.08,colour:.06},mono:{label:"Black and white",colour:-1,contrast:.16,sharp:.2,vignette:.18,clarity:.15}};const M=["light","contrast","warmth","tint","colour","sharp","vignette","shadows","highlights","fade","clarity","denoise","black","wbr","wbb"];export function lookParams(a){const t=LOOKS[a&&a.preset||"natural"]||LOOKS.natural,i=a&&a.auto&&a.autoOn!==!1?a.auto:null,n=a&&a.autoAmt!==void 0?a.autoAmt:1,c={};for(const e of M)c[e]=(t[e]||0)+(a&&a.adj&&a.adj[e]||0)+(i?(i[e]||0)*n:0);return c}export function isNeutral(a){const t=lookParams(a);return M.every(i=>Math.abs(t[i])<.001)}const Y="attribute vec2 p; varying vec2 uv; void main(){ uv = vec2((p.x+1.0)/2.0, 1.0-(p.y+1.0)/2.0); gl_Position = vec4(p,0.0,1.0); }",j="precision mediump float; varying vec2 uv; uniform sampler2D tex; void main(){ gl_FragColor = vec4(texture2D(tex, uv).rgb, 1.0); }",K=`
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
varying vec2 uv; uniform sampler2D tex; uniform sampler2D blur; uniform vec2 px;
uniform float light, contrast, warmth, tint, colour, sharp, vignette, shadows, highlights, fade, clarity, denoise, black, wbr, wbb;
float luma(vec3 c){ return dot(c, vec3(0.2126,0.7152,0.0722)); }
vec3 toLin(vec3 c){ return pow(max(c, 0.0), vec3(2.2)); }
vec3 toGam(vec3 c){ return pow(max(c, 0.0), vec3(1.0/2.2)); }
float rnd(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
void main(){
  vec3 c0 = texture2D(tex, uv).rgb;
  vec3 c = c0;
  // noise: an average of the neighbours that look alike (edges stay sharp); colour noise more
  if (denoise > 0.0) {
    vec3 s = c0; float ws = 1.0;
    float k = 1.0 / (0.002 + denoise * 0.03);
    for (int i = 0; i < 16; i++) {
      float a = float(i) * 0.785398 + (i >= 8 ? 0.3927 : 0.0);
      vec2 o = vec2(cos(a), sin(a)) * px * (i >= 8 ? 1.0 + denoise * 2.5 : 1.0 + denoise * 0.8);
      vec3 q = texture2D(tex, uv + o).rgb;
      vec3 dq = q - c0; float w = exp(-dot(dq, dq) * k);
      s += q * w; ws += w;
    }
    vec3 m = s / ws;
    float a = clamp(denoise, 0.0, 1.0);
    // (the light smoothed gently, the colour noise more firmly)
    float ly = mix(luma(c0), luma(m), a * 0.8);
    vec3 ch = mix(c0 - luma(c0), m - luma(m), min(1.0, a * 1.4));
    c = vec3(ly) + ch;
  }
  // sharpness: the fine detail of the light only, a little held back where it is only noise
  if (sharp != 0.0) {
    vec3 b = (texture2D(tex, uv+vec2(px.x,0.0)).rgb + texture2D(tex, uv-vec2(px.x,0.0)).rgb + texture2D(tex, uv+vec2(0.0,px.y)).rgb + texture2D(tex, uv-vec2(0.0,px.y)).rgb) * 0.25;
    float d = luma(c0) - luma(b);
    float keep = smoothstep(0.004, 0.02, abs(d));
    c += vec3(d) * sharp * 1.4 * (sharp > 0.0 ? keep : 1.0);
  }
  // the black point: a grey veil over the darkest parts goes
  c = (c - black) / max(0.5, 1.0 - black);
  vec3 lin = toLin(c);
  // the white balance found by Auto (gains on red and blue)
  lin *= vec3(1.0 + wbr, 1.0, 1.0 + wbb);
  // white balance (temperature and tint) and exposure, in light, as a camera would
  lin *= vec3(1.0 + warmth * 0.16, 1.0 + tint * 0.08, 1.0 - warmth * 0.18) * pow(2.0, light);
  // the light around this point (blurred): shadows lifted and highlights brought down where they
  // are, and clarity (local contrast), without darkening or flattening the whole picture
  float lb = luma(toLin(texture2D(blur, uv, 4.0).rgb)) * pow(2.0, light);
  float lp = luma(lin);
  float sh = shadows * 0.9 * (1.0 - smoothstep(0.02, 0.35, lb));
  float hl = highlights * 0.55 * smoothstep(0.35, 1.0, lb);
  lin *= pow(2.0, sh - hl);
  if (clarity != 0.0) {
    float lbl = max(lb, 1e-4);
    float r = clamp(lp / lbl, 0.25, 4.0);
    lin *= pow(r, clarity * 0.5);
  }
  // a soft shoulder when the picture is made brighter: bright parts roll off instead of clipping
  // (left as it is otherwise)
  float G = pow(2.0, max(light, 0.0)) * max(1.0 + max(wbr, wbb), 1.0) * pow(2.0, max(shadows, 0.0) * 0.3);
  if (G > 1.01) {
    float R = max(G - 0.8, 0.2);
    vec3 e = max(lin - 0.8, 0.0);
    vec3 rolled = 0.8 + 0.2 * (1.0 - exp(-3.0 * e / R)) / 0.9502;
    lin = mix(lin, mix(lin, rolled, step(0.8, lin)), clamp((G - 1.0) * 6.0, 0.0, 1.0));
  }
  vec3 g = toGam(lin);
  // contrast as an S around the middle grey
  float y = luma(g);
  float ys = clamp(y, 0.0, 1.0);
  float s = ys + contrast * (ys - 0.5) * (1.0 - abs(ys - 0.5) * 1.4);
  g *= s / max(y, 1e-4);
  // colour: vibrance (the dull colours more than the strong ones, skin kept natural), or none
  y = luma(g);
  float sat = max(max(g.r, g.g), g.b) - min(min(g.r, g.g), g.b);
  float amt = colour < 0.0 ? colour : colour * (1.2 - sat);
  g = mix(vec3(y), g, 1.0 + amt);
  g = mix(g, g * 0.82 + 0.09, fade * 1.6);
  vec2 dv = uv - 0.5; float v = 1.0 - vignette * 0.7 * smoothstep(0.2, 0.9, dot(dv, dv) * 2.0);
  g *= v;
  // a touch of grain-free dither: smooth skies and walls without bands
  g += (rnd(uv * 997.0) - 0.5) / 255.0;
  gl_FragColor = vec4(clamp(g, 0.0, 1.0), 1.0);
}`;export class Grader{constructor(){this.canvas=document.createElement("canvas"),this.ok=null}_init(){const t=this.canvas.getContext("webgl",{premultipliedAlpha:!1,preserveDrawingBuffer:!0})||this.canvas.getContext("experimental-webgl");if(!t){this.ok=!1;return}const i=(r,s)=>{const h=t.createShader(r);return t.shaderSource(h,s),t.compileShader(h),h},n=r=>{const s=t.createProgram();return t.attachShader(s,i(t.VERTEX_SHADER,Y)),t.attachShader(s,i(t.FRAGMENT_SHADER,r)),t.linkProgram(s),t.getProgramParameter(s,t.LINK_STATUS)?s:null},c=n(K),e=n(j);if(!c||!e){this.ok=!1;return}const m=t.createBuffer();t.bindBuffer(t.ARRAY_BUFFER,m),t.bufferData(t.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),t.STATIC_DRAW);for(const r of[c,e]){const s=t.getAttribLocation(r,"p");t.enableVertexAttribArray(s),t.vertexAttribPointer(s,2,t.FLOAT,!1,0,0)}const g=()=>{const r=t.createTexture();return t.bindTexture(t.TEXTURE_2D,r),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_WRAP_S,t.CLAMP_TO_EDGE),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_WRAP_T,t.CLAMP_TO_EDGE),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_MIN_FILTER,t.LINEAR),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_MAG_FILTER,t.LINEAR),r};this.tex=g(),this.btex=g(),this.B=256,t.texImage2D(t.TEXTURE_2D,0,t.RGBA,this.B,this.B,0,t.RGBA,t.UNSIGNED_BYTE,null),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_MIN_FILTER,t.LINEAR_MIPMAP_LINEAR),this.fb=t.createFramebuffer(),t.bindFramebuffer(t.FRAMEBUFFER,this.fb),t.framebufferTexture2D(t.FRAMEBUFFER,t.COLOR_ATTACHMENT0,t.TEXTURE_2D,this.btex,0),t.bindFramebuffer(t.FRAMEBUFFER,null),t.useProgram(c),this.u={};for(const r of["px","tex","blur",...M])this.u[r]=t.getUniformLocation(c,r);this.cu=t.getUniformLocation(e,"tex"),this.main=c,this.copy=e,this.gl=t,this.ok=!0}render(t,i,n,c){if(this.ok===null&&this._init(),!this.ok)return null;const e=this.gl,m=this.canvas;i=Math.max(2,Math.round(i)),n=Math.max(2,Math.round(n)),(m.width!==i||m.height!==n)&&(m.width=i,m.height=n),e.activeTexture(e.TEXTURE0),e.bindTexture(e.TEXTURE_2D,this.tex);try{e.texImage2D(e.TEXTURE_2D,0,e.RGBA,e.RGBA,e.UNSIGNED_BYTE,t)}catch{return null}const g=lookParams(c);e.useProgram(this.copy),e.uniform1i(this.cu,0),e.bindFramebuffer(e.FRAMEBUFFER,this.fb),e.viewport(0,0,this.B,this.B),e.drawArrays(e.TRIANGLE_STRIP,0,4),e.bindFramebuffer(e.FRAMEBUFFER,null),e.activeTexture(e.TEXTURE1),e.bindTexture(e.TEXTURE_2D,this.btex),e.generateMipmap(e.TEXTURE_2D),e.activeTexture(e.TEXTURE0),e.useProgram(this.main),e.uniform1i(this.u.tex,0),e.uniform1i(this.u.blur,1),e.viewport(0,0,i,n);const r=t.videoWidth||t.width||i,s=t.videoHeight||t.height||n;e.uniform2f(this.u.px,1/r,1/s);for(const h of M)e.uniform1f(this.u[h],g[h]);return e.drawArrays(e.TRIANGLE_STRIP,0,4),m}}export function autoLook(a){const n=document.createElement("canvas");n.width=96,n.height=96;const c=n.getContext("2d",{willReadFrequently:!0}),e=[],m=new Float64Array(256);let g=0,r=0,s=0,h=0,U=0,_=0,k=0;for(const f of a){c.drawImage(f,0,0,96,96);const l=c.getImageData(0,0,96,96).data;for(let u=0;u<96;u++)for(let p=0;p<96;p++){const x=(u*96+p)*4,T=l[x],w=l[x+1],R=l[x+2],b=.2126*T+.7152*w+.0722*R;m[Math.round(b)]++,e.push(b);const y=Math.max(T,w,R),P=Math.min(T,w,R);if(k+=y?(y-P)/y:0,b>30&&b<235&&y-P<60&&(g+=T,r+=w,s+=R,h++),p>0&&u>0&&p<95){const F=x-4,D=x-96*4,S=Math.abs(b-(.2126*l[F]+.7152*l[F+1]+.0722*l[F+2])),B=Math.abs(b-(.2126*l[D]+.7152*l[D+1]+.0722*l[D+2]));S<12&&B<12&&(U+=S+B,_++)}}}const v=e.length;if(!v)return{};const d=f=>{let l=0;for(let u=0;u<256;u++)if(l+=m[u],l>=f*v)return u;return 255},E=d(.01),I=d(.05),L=d(.25),G=d(.5),X=d(.75),N=d(.95),W=d(.995),o={},V=118,A=E>14?Math.min(51,E-10):0,C=(.5*G+.5*X-A)/(1-A/255);o.light=Math.max(-.6,Math.min(1,Math.log2(128/Math.max(18,C))*.8)),o.shadows=Math.max(0,Math.min(.4,Math.max((40-I)/70,(70-(L-A))/140))),o.highlights=Math.max(0,Math.min(.7,(W-235)/25));const H=N-I;if(o.contrast=Math.max(-.12,Math.min(.25,(150-H)/400)),h>v*.05){const f=x=>Math.pow(x/255,2.2),l=f(g/h),u=f(r/h),p=f(s/h);o.wbr=Math.max(-.4,Math.min(.6,(u/Math.max(.001,l)-1)*.8)),o.wbb=Math.max(-.4,Math.min(.6,(u/Math.max(.001,p)-1)*.8))}E>14&&(o.black=Math.min(.2,(E-10)/255));const O=k/v;o.colour=Math.max(0,Math.min(.25,(.3-O)*.8));const q=_?U/_:0;o.denoise=Math.max(0,Math.min(.8,(q-2.2)/4)),o.sharp=Math.max(.05,.22-o.denoise*.25),o.clarity=.08;for(const f of Object.keys(o))o[f]=+o[f].toFixed(3);return o}
