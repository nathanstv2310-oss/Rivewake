// Bellwether Vale, built in metres. Walkable roofs, the belfry, street furniture
// and market stalls use the same solids for rendering and collision.
const bounds = {minX: -66, maxX: 66, minZ: -55, maxZ: 55};
const boxes = [], ramps = [], decor = [], signs = [];
const stone = '#adab93', limestone = '#d6c8a1', paving = '#c5b499';
const cream = '#f2dcaa', timber = '#795741', walnut = '#573f36';
const coal = '#34464b', pane = '#4c7373', blueGlass = '#8eb5a3';
const brass = '#e4ac4c', gold = '#ffcf63', jade = '#4b9075';
const clay = '#b95d48', tile = '#d27d56', fir = '#47785d';
const homes = {
  honey:  {wall: '#e6bd78', base: '#b38b68', shutter: '#42847b', roof: '#b75e46', edge: '#dd8a60'},
  sage:   {wall: '#a8bb91', base: '#859384', shutter: '#41736a', roof: '#677f86', edge: '#829a98'},
  rose:   {wall: '#d68d76', base: '#ab7464', shutter: '#43867d', roof: '#a85b47', edge: '#d27b56'},
  butter: {wall: '#e8d7a5', base: '#b7a587', shutter: '#557999', roof: '#b66b43', edge: '#e19860'},
  blue:   {wall: '#93b5b3', base: '#779393', shutter: '#426877', roof: '#9b5c48', edge: '#c57c56'},
  lilac:  {wall: '#c2abac', base: '#a39191', shutter: '#5b778e', roof: '#727a88', edge: '#9996a2'}
};

function solid(x, y, z, w, h, d, color) {
  boxes.push({x, y, z, w, h, d, color});
}
function mark(x, y, z, w, h, d, color, angle = 0) {
  decor.push({x, y, z, w, h, d, color, angle});
}
function sign(x, y, z, yaw, text, width, height, fg = cream, bg = coal) {
  signs.push({x, y, z, yaw, text, width, height, fg, bg});
}

// Offsets along each façade are expressed from the perspective of a person
// facing it, so shutters, door jambs and projecting signs line up on every side.
function face(x, z, w, d, side) {
  const [nx, nz] = {N: [0,-1], E: [1,0], S: [0,1], W: [-1,0]}[side];
  return {x: x + nx * w / 2, z: z + nz * d / 2,
    nx, nz, ux: nz, uz: -nx, span: nx ? d : w, yaw: Math.atan2(nx, nz)};
}
function onFace(f, u, y, out, width, height, depth, color) {
  mark(f.x + f.ux*u + f.nx*out, y, f.z + f.uz*u + f.nz*out,
    f.nx ? depth : width, height, f.nx ? width : depth, color);
}
function wallSign(f, y, text, width, height, fg = cream, bg = coal) {
  sign(f.x + f.nx*.12, y, f.z + f.nz*.12, f.yaw, text, width, height, fg, bg);
}
function windowOn(f, u, y, shutter, small = false) {
  const w = small ? 0.86 : 1.20, h = small ? 0.84 : 1.17;
  onFace(f,u,y,.026,w+.17,h+.16,.079,timber);
  onFace(f,u,y+.08,.074,w,h,.033,pane);
  onFace(f,u-.16,y+.13,.094,.08,h-.09,.008,blueGlass);
  onFace(f,u,y+h*.51,.097,w,.055,.010,limestone);
  onFace(f,u,y+h*.99,.072,w+.23,.10,.16,cream);
  onFace(f,u,y-.048,.079,w+.32,.11,.18,limestone);
  for (const side of [-1,1]) {
    onFace(f,u+side*(w*.56+.14),y+.04,.044,.265,h+.02,.07,shutter);
    onFace(f,u+side*(w*.56+.14),y+h*.63,.085,.265,.069,.027,walnut);
  }
}
function doorOn(f, shutter) {
  onFace(f,0,0,.035,1.75,2.64,.086,timber);
  onFace(f,0,.025,.091,1.47,2.39,.038,shutter);
  for (const u of [-.50,-.18,.18,.50]) onFace(f,u,.12,.115,.027,2.20,.013,walnut);
  onFace(f,0,2.03,.12,1.46,.105,.030,timber);
  onFace(f,-.46,1.03,.13,.13,.084,.055,brass);
  onFace(f,0,2.59,.07,1.95,.12,.16,cream);
}

function gable(x, y, z, w, d, style, alongX = true, levels = 4, rise = .50) {
  for (let i=0;i<levels;i++) {
    const scale = 1-i/(levels-.03);
    const rw = (w + .18)*(alongX ? 1 : scale);
    const rd = (d + .18)*(alongX ? scale : 1);
    solid(x,y+i*rise,z,rw,rise,rd,style.roof);
    mark(x,y+i*rise+rise-.082,z,rw+.035,.082,rd+.035,style.edge);
  }
}

function house({x,z,w,d,h,style,front='S',name='',terrace=false,ridgeX=true,upper=1}) {
  solid(x,0,z,w,h,d,style.wall);
  mark(x,.018,z,w+.045,.53,d+.045,style.base);
  mark(x,h-.23,z,w+.10,.20,d+.10,timber);
  for (const side of ['N','E','S','W']) {
    const f = face(x,z,w,d,side), isEntry = side===front;
    for (const s of [-1,1]) {
      for (let row=0;row<4;row++) {
        onFace(f,s*(f.span/2-.22-row%2*.13),.62+row*.76,.026,
          .46+row%2*.22,.22,.07,style.base);
      }
    }
    if (isEntry) {
      doorOn(f,style.shutter);
      if (name) wallSign(f,h-.78,name,Math.min(w*.66,6.5),.71,cream,style.shutter);
    }
    const links = f.span < 9.5 ? [-.29,.29] : [-.34,-.17,.17,.34];
    for (const offset of links) {
      if (isEntry && Math.abs(offset)<.20) continue;
      windowOn(f,offset*f.span,1.25+(isEntry?.12:0),style.shutter,f.span<11);
    }
    if (h>5.25 && !isEntry) {
      for (const u of [-.25,.25]) windowOn(f,u*f.span,h-1.95,style.shutter,true);
    }
  }
  if (!terrace) {
    gable(x,h,z,w,d,style,ridgeX);
    const chimneyX=x+(ridgeX ? w*.27 : 0), chimneyZ=z+(ridgeX ? 0 : d*.25);
    solid(chimneyX,h+2,chimneyZ,.81,1.25,.92,style.base);
    mark(chimneyX,h+3.12,chimneyZ,.87,.15,.98,cream);
    mark(chimneyX,h+3.262,chimneyZ,.48,.012,.63,walnut);
    return;
  }
  // Open tiled gallery. Place the little attic against one end, clear of the
  // opposite ramp landing and of the route around the gallery's outer edges.
  mark(x,h-.01,z,w,.014,d,'#d3a583');
  for (let i=1;i<5;i++) mark(x-w/2+w*i/5,h+.005,z,.039,.007,d-.10,style.base);
  const atticX=x+upper*w*.22, atticW=w*.39, atticD=d*.50;
  solid(atticX,h,z,atticW,2.15,atticD,style.wall);
  for (const s of ['N','S']) {
    const f=face(atticX,z,atticW,atticD,s);
    windowOn(f,0,h+.61,style.shutter,true);
  }
  gable(atticX,h+2.15,z,atticW,atticD,style,true,3,.39);
}
function ascent(x, z, w, h, d, dir, color) {
  ramps.push({x,y:0,z,w,h,d,dir,color});
  const alongX=dir.endsWith('x'), direction=dir[0]==='+' ? 1 : -1;
  // Pale setts are inset a few centimetres into the sloping pavement.
  const count=12, len=alongX?w:d;
  for (let i=1;i<count;i++) {
    const t=i/count, along=direction*(t-.5)*len;
    mark(x+(alongX?along:0),h*t-.031,z+(alongX?0:along),
      alongX?.10:w-.15,.045,alongX?d-.15:.10,cream);
  }
}

// Broad streets and the square use flush stonework. Slender, broken courses
// in the paving retain the farmland greens between the village blocks.
function street(x, z, w, d, alongX, level) {
  mark(x,level,z,w,.009,d,paving);
  const len=alongX?w:d, width=alongX?d:w;
  for (const side of [-1,1]) {
    mark(x+(alongX?0:side*width*.47),level+.011,z+(alongX?side*width*.47:0),
      alongX?w:.13,.007,alongX?.13:d,limestone);
  }
  let row=0;
  for (let offset=-len/2+1.7;offset<len/2-1;offset+=3.4,row++) {
    const cross=((row*7)%11-5)*width*.068;
    mark(x+(alongX?offset:cross),level+.012,z+(alongX?cross:offset),
      alongX?.82:.39,.006,alongX?.39:.82,row%3 ? '#d2c2a8' : '#b8a990');
  }
}
for (const [x,w] of [[-62,5],[-40,6.4],[-15,7.6],[14.8,7.7],[44.2,6.3],[62,5.2]]) {
  street(x,0,w,104,false,.003);
}
for (const [z,d] of [[-49.5,6.0],[-21.4,7.6],[18.9,8.1],[49.1,6.3]]) {
  street(0,z,126,d,true,.026);
}
street(-49.5,4.8,24,5.0,true,.026);
street(47.7,-1.5,28.1,5.0,true,.026);
mark(1.5,.048,1.2,38,.012,35.1,'#cdba9c');
for (const side of [-1,1]) {
  mark(1.5+side*18.40,.061,1.2,.27,.007,34.2,limestone);
  mark(1.5,.061,1.2+side*16.78,37.05,.007,.27,limestone);
}
for (let row=0;row<7;row++) for (let col=0;col<8;col++) {
  const x=-14+col*4.26+(row%2)*.57, z=-12.4+row*4.17;
  mark(x,.062,z,.89,.006,.32,'#dfcbb0',row%2?.15:-.15);
}

// Northwest bakery, central mill loft, northeastern counting house,
// apothecary and southern inn each offer an alternate route above the lanes.
house({x:-52,z:-35,w:14,d:13,h:5.1,style:homes.rose,name:'POTTERS YARD'});
house({x:-24,z:-35,w:18,d:14,h:4.15,style:homes.honey,terrace:true,upper:-1,name:'GOLDEN LOAF'});
ascent(-19.9,-21.5,4.5,4.15,13,'-z',limestone);
house({x:4,z:-35.8,w:15.4,d:13.3,h:5.35,style:homes.blue,front:'W',name:'VANE & VELLUM'});
house({x:34,z:-35.3,w:18,d:14,h:4.5,style:homes.sage,terrace:true,upper:-1,name:'CANDLE HOUSE'});
ascent(49.7,-37.9,13.4,4.5,4.3,'-x',stone);
house({x:56.7,z:-19.2,w:9.1,d:9.4,h:4.05,style:homes.butter,front:'W',ridgeX:false});
house({x:-52.3,z:-9.4,w:12.6,d:14,h:4.8,style:homes.butter,front:'E',ridgeX:false});
house({x:-31.3,z:-.6,w:15.8,d:14.4,h:3.85,style:homes.blue,front:'E',terrace:true,upper:-1,name:'MILL STEPS'});
ascent(-27.25,12.6,4.5,3.85,12,'-z',stone);
house({x:-52.5,z:16,w:11.2,d:9.4,h:4.35,style:homes.sage,front:'E'});
house({x:32.2,z:-4.4,w:15.6,d:14.4,h:4.05,style:homes.lilac,front:'W',terrace:true,upper:-1,name:'FENNEL & FIG'});
ascent(46.2,-6.5,12.4,4.05,4.5,'-x',limestone);
house({x:55.3,z:7.1,w:10.6,d:11.4,h:5.4,style:homes.rose,front:'W',ridgeX:false});
house({x:32.6,z:15.8,w:8.8,d:7.3,h:3.7,style:homes.honey,front:'S'});
house({x:-53.9,z:37,w:13.7,d:12,h:4.7,style:homes.honey,front:'N'});
house({x:-30.3,z:35.5,w:15.3,d:14.3,h:5.3,style:homes.rose,front:'N',ridgeX:false,name:'THE COPPER COOPER'});
house({x:-3.2,z:36.2,w:18.5,d:12.8,h:4.2,style:homes.butter,front:'N',terrace:true,upper:1,name:'THE RIVER LARK'});
ascent(-7.85,23.5,4.4,4.2,12.6,'+z',limestone);
house({x:23.4,z:36.1,w:12.6,d:14.5,h:5.1,style:homes.lilac,front:'N',ridgeX:false});
house({x:50.7,z:35.9,w:16,d:13.8,h:5.6,style:homes.honey,front:'W',name:'ORCHARD STORES'});

// The belfry has a real open bell chamber. A tiled clock face wraps each side
// of the masonry, and the brass bell is visible through the timber structure.
const bx=-3.8, bz=-7.2;
solid(bx,0,bz,7.6,1.18,7.2,'#ac9983');
solid(bx,1.18,bz,6.7,9.17,6.4,'#e3c494');
mark(bx,1.15,bz,7.64,.15,7.24,limestone);
for (const y of [3.75,6.55,10.13]) mark(bx,y,bz,6.83,.19,6.54,cream);
for (const side of ['N','S','E','W']) {
  const wall=face(bx,bz,6.7,6.4,side);
  if (side==='S' || side==='W') {
    onFace(wall,0,1.19,.027,1.38,2.12,.073,walnut);
    for (const k of [-.42,0,.42]) onFace(wall,k,1.22,.076,.055,1.99,.031,timber);
    onFace(wall,0,3.10,.070,1.57,.18,.13,limestone);
  } else {
    windowOn(wall,0,2.21,homes.sage.shutter,true);
  }
  for (const s of [-1,1]) {
    onFace(wall,s*(wall.span*.45),1.19,.037,.28,9.10,.075,'#cab08a');
    onFace(wall,s*(wall.span*.39),6.84,.040,.11,3.14,.084,cream);
  }
  // Screen-space runs make the face octagonal with a brass rim, pale ticks
  // and a dark hand pointing to four. The artwork is original voxel geometry.
  for (let v=-6;v<=6;v++) {
    let previous=null, start=-6;
    for (let u=-6;u<=7;u++) {
      const r=Math.hypot(u,v);
      let color=null;
      if (u<7 && r<6.55) {
        if (r>5.37) color=brass;
        else if (r>3.92 && (!u || !v || Math.abs(u)===Math.abs(v))) color=cream;
        else if ((u===0 && v>=0 && v<=3) || (u>0 && u<=3 && v===-Math.round(u*.67))) color=gold;
        else color=coal;
      }
      if (color!==previous) {
        if (previous) onFace(wall,(start+u-1)*.122,8.40+v*.244,.066,(u-start)*.244,.244,.079,previous);
        previous=color;start=u;
      }
    }
  }
}
solid(bx,10.35,bz,7.25,.45,6.91,'#966c55');
for (const sx of [-1,1]) for (const sz of [-1,1]) {
  const x=bx+sx*2.70, z=bz+sz*2.55;
  solid(x,10.80,z,.65,3.75,.65,timber);
  mark(x,10.81,z,.70,.26,.70,cream);
  mark(x,14.24,z,.72,.20,.72,brass);
}
solid(bx,14.22,bz,.50,.36,.57,walnut);
solid(bx,13.37,bz,1.16,.85,1.2,brass);
solid(bx,12.57,bz,1.65,.80,1.62,'#d49b46');
solid(bx,12.29,bz,2.32,.28,2.12,brass);
solid(bx,11.97,bz,.41,.32,.43,walnut);
solid(bx,14.55,bz,7.47,.37,7.06,timber);
for (let i=0;i<4;i++) {
  solid(bx,14.92+i*.66,bz,7.1-i*1.54,.66,6.78-i*1.45,i%2?'#5b877a':'#47796e');
  mark(bx,15.49+i*.66,bz,7.15-i*1.54,.09,6.83-i*1.45,'#82a590');
}
mark(bx,17.56,bz,.23,1.52,.24,brass);
mark(bx+.17,18.70,bz,1.17,.22,.18,gold);
mark(bx+.59,18.91,bz,.37,.22,.18,gold);
mark(bx-.37,18.91,bz,.35,.14,.18,gold);

// Low stone walls mark the playable village boundary and protect the lanes.
for(const side of [-1,1]){
  solid(side*66.4,0,0,.8,2.6,110.8,stone);
  solid(0,0,side*55.4,132,2.6,.8,stone);
  mark(side*66.4,2.6,0,1,.16,110.8,limestone);
  mark(0,2.6,side*55.4,132,.16,1,limestone);
}
// Market cover keeps the square's open approaches from becoming one long shot.
for(const [x,z] of [[10,4],[-8,9],[7,-12],[20,22]]){
  solid(x,0,z,3.8,1.1,2.1,timber);
  mark(x,1.1,z,4,.1,2.3,cream);
}
export const VILLAGE={name:'Bellwether Vale',bounds,floorColor:'#91a881',boxes,ramps,decor,signs,
  preview:{eye:[24,16,27],target:[-3,6,-7]}};
